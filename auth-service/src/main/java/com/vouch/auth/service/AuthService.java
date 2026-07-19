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
import org.springframework.beans.factory.annotation.Value;
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
import java.util.List;
import java.util.Map;

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

    @Value("${sendgrid.api-key}")
    private String sendGridApiKey;

    @Value("${sendgrid.from-email}")
    private String sendGridFromEmail;

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

    // Routed by what the user actually typed: a phone number gets the code via
    // push notification (device-based — works as long as they've logged into
    // the app before and have a pushToken on file), an email address gets the
    // code by real email via sendOtpEmail. Deliberately NOT a generic
    // "if an account exists..." response — told to explicitly confirm whether
    // the identifier is on file, at the cost of allowing account enumeration.
    public Map<String, String> forgotPassword(ForgotPasswordRequest request) {
        String identifier = request.getIdentifier().trim();
        boolean isEmail = identifier.contains("@");

        if (isEmail) {
            User user = userRepository.findByEmail(identifier)
                    .orElseThrow(() -> new RuntimeException("No account found with that email address"));
            String otp = generateAndStoreOtp(user);
            sendOtpEmail(user.getEmail(), otp);
            return Map.of("message", "Check your inbox — we've emailed a 6-digit code to " + user.getEmail() + ". It expires in 10 minutes.");
        }

        User user = userRepository.findByPhone(identifier)
                .orElseThrow(() -> new RuntimeException("No account found with that phone number"));
        if (user.getPushToken() == null || user.getPushToken().isEmpty()) {
            boolean hasEmail = user.getEmail() != null && !user.getEmail().isBlank();
            throw new RuntimeException("This account has no device registered for push notifications." +
                    (hasEmail ? " Try again using your email address instead." : " No email is on file for this account either — contact support."));
        }
        String otp = generateAndStoreOtp(user);
        sendOtpPush(user.getPushToken(), otp);
        return Map.of("message", "Check your notifications — we've sent a 6-digit code to your device. It expires in 10 minutes.");
    }

    private String generateAndStoreOtp(User user) {
        String otp = String.format("%06d", OTP_RANDOM.nextInt(1_000_000));
        user.setResetOtpHash(passwordEncoder.encode(otp));
        user.setResetOtpExpiry(LocalDateTime.now().plusMinutes(OTP_VALID_MINUTES));
        user.setResetOtpAttempts(0);
        userRepository.save(user);
        return otp;
    }

    public Map<String, String> resetPassword(ResetPasswordRequest request) {
        String identifier = request.getIdentifier().trim();
        User user = identifier.contains("@")
                ? userRepository.findByEmail(identifier)
                        .orElseThrow(() -> new RuntimeException("No account found with that email address"))
                : userRepository.findByPhone(identifier)
                        .orElseThrow(() -> new RuntimeException("No account found with that phone number"));

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

    // Sent via SendGrid's HTTP API (not SMTP) — Railway blocks outbound SMTP
    // ports on non-Pro plans, but a normal HTTPS POST goes through unaffected.
    private void sendOtpEmail(String email, String otp) {
        if (sendGridApiKey == null || sendGridApiKey.isBlank()) {
            log.warn("SENDGRID_API_KEY is not configured — cannot send OTP email to {}", email);
            throw new RuntimeException("Email delivery isn't configured yet. Try resetting with your phone number instead.");
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(sendGridApiKey);

            String body = "Your Vouch password reset code is " + otp + ".\n\n" +
                    "It expires in " + OTP_VALID_MINUTES + " minutes. If you didn't request this, ignore this email.";

            Map<String, Object> payload = Map.of(
                    "personalizations", List.of(Map.of("to", List.of(Map.of("email", email)))),
                    "from", Map.of("email", sendGridFromEmail, "name", "Vouch"),
                    "subject", "Vouch password reset code",
                    "content", List.of(Map.of("type", "text/plain", "value", body))
            );

            restTemplate.postForEntity("https://api.sendgrid.com/v3/mail/send",
                    new HttpEntity<>(payload, headers), String.class);
        } catch (Exception e) {
            log.warn("Failed to email password reset OTP to {}: {}", email, e.getMessage());
            throw new RuntimeException("Could not send the reset code to that email address right now. Please try again shortly.");
        }
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