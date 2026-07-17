package com.vouch.auth.service;

import com.vouch.auth.dto.AuthResponse;
import com.vouch.auth.dto.ForgotPasswordRequest;
import com.vouch.auth.dto.LoginRequest;
import com.vouch.auth.dto.RegisterRequest;
import com.vouch.auth.dto.ResetPasswordRequest;
import com.vouch.auth.entity.User;
import com.vouch.auth.repository.UserRepository;
import com.vouch.auth.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private static final SecureRandom OTP_RANDOM = new SecureRandom();
    private static final int OTP_VALID_MINUTES = 10;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final RestTemplate restTemplate;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new RuntimeException("Phone number already registered");
        }

        if (request.getEmail() != null && !request.getEmail().isBlank() && userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already in use");
        }

        User user = User.builder()
                .phone(request.getPhone())
                .password(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .momoProvider(request.getMomoProvider())
                .momoNumber(request.getMomoNumber())
                .trustScore(50.0)
                .totalLoansGiven(0)
                .totalLoansReceived(0)
                .loansRepaidOnTime(0)
                .defaults(0)
                .borrowingSuspended(false)
                .permanentBan(false)
                .role(User.Role.USER)
                .build();

        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getPhone());

        return AuthResponse.builder()
                .token(token)
                .phone(user.getPhone())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .trustScore(user.getTrustScore())
                .message("Registration successful")
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        User user;

        if ("email".equals(request.getLoginMethod())) {
            // Look up by email, then verify password manually
            user = userRepository.findByEmail(request.getIdentifier())
                    .orElseThrow(() -> new RuntimeException("No account found with this email address"));

            if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                throw new RuntimeException("Invalid password");
            }
        } else {
            // Default: login by phone (original behaviour unchanged)
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getIdentifier(), request.getPassword())
            );
            user = userRepository.findByPhone(request.getIdentifier())
                    .orElseThrow(() -> new RuntimeException("No account found with this phone number"));
        }

        String token = jwtUtil.generateToken(user.getPhone());

        return AuthResponse.builder()
                .token(token)
                .phone(user.getPhone())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .trustScore(user.getTrustScore())
                .message("Login successful")
                .build();
    }

    public void savePushToken(String phone, String pushToken) {
        User user = userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setPushToken(pushToken);
        userRepository.save(user);
    }

    // Sends a one-time 6-digit code straight to the user's own device via push
    // notification (their pushToken is still on file from their last app login,
    // even if they're currently logged out — that's the "forgot password but the
    // app is still installed" case this is built for). There is no email/SMS
    // provider wired into this project, so a device that never registered a push
    // token has no recovery path here — that's a known, deliberate limitation,
    // not an oversight: it beats the alternative of resetting any account with
    // nothing but a phone number.
    public Map<String, String> forgotPassword(ForgotPasswordRequest request) {
        Optional<User> userOpt = userRepository.findByPhone(request.getIdentifier())
                .or(() -> userRepository.findByEmail(request.getIdentifier()));

        // Always return the same generic message regardless of whether the
        // account exists or has a push token — never let this endpoint be used
        // to enumerate valid phone numbers/emails.
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (user.getPushToken() != null && !user.getPushToken().isEmpty()) {
                String otp = String.format("%06d", OTP_RANDOM.nextInt(1_000_000));
                user.setResetOtpHash(passwordEncoder.encode(otp));
                user.setResetOtpExpiry(LocalDateTime.now().plusMinutes(OTP_VALID_MINUTES));
                user.setResetOtpAttempts(0);
                userRepository.save(user);
                sendOtpPush(user.getPushToken(), otp);
            } else {
                log.info("Password reset requested for an account with no registered device — nothing sent.");
            }
        }

        return Map.of("message",
                "If an account with that phone number or email exists and has Vouch installed, " +
                "a 6-digit code has been sent to that device.");
    }

    public Map<String, String> resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByPhone(request.getIdentifier())
                .or(() -> userRepository.findByEmail(request.getIdentifier()))
                .orElseThrow(() -> new RuntimeException("No account found with that phone number or email"));

        if (user.getResetOtpHash() == null || user.getResetOtpExpiry() == null) {
            throw new RuntimeException("No reset code was requested for this account. Start over from 'Forgot password?'");
        }
        if (user.getResetOtpExpiry().isBefore(LocalDateTime.now())) {
            user.setResetOtpHash(null);
            user.setResetOtpExpiry(null);
            userRepository.save(user);
            throw new RuntimeException("This code has expired. Request a new one.");
        }
        // Cap wrong attempts so a 6-digit code can't just be brute-forced within
        // its 10-minute window — 5 misses burns the code, forcing a fresh request.
        int attempts = user.getResetOtpAttempts() == null ? 0 : user.getResetOtpAttempts();
        if (attempts >= 5) {
            user.setResetOtpHash(null);
            user.setResetOtpExpiry(null);
            userRepository.save(user);
            throw new RuntimeException("Too many incorrect attempts. Request a new code.");
        }
        if (!passwordEncoder.matches(request.getOtp(), user.getResetOtpHash())) {
            user.setResetOtpAttempts(attempts + 1);
            userRepository.save(user);
            throw new RuntimeException("Incorrect code.");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setResetOtpHash(null);
        user.setResetOtpExpiry(null);
        user.setResetOtpAttempts(0);
        userRepository.save(user);

        return Map.of("message", "Password reset successful. You can now log in with your new password.");
    }

    private void sendOtpPush(String pushToken, String otp) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, Object> body = Map.of(
                    "to", pushToken,
                    "title", "Vouch password reset code",
                    "body", "Your code is " + otp + ". It expires in " + OTP_VALID_MINUTES + " minutes.",
                    "data", Map.of("type", "PASSWORD_RESET_OTP")
            );
            restTemplate.postForObject("https://exp.host/--/api/v2/push/send",
                    new HttpEntity<>(body, headers), Map.class);
        } catch (Exception e) {
            log.warn("Failed to push password reset OTP: {}", e.getMessage());
        }
    }
}