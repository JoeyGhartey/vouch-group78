package com.vouch.auth.service;

import com.vouch.auth.dto.AuthResponse;
import com.vouch.auth.dto.LoginRequest;
import com.vouch.auth.dto.RegisterRequest;
import com.vouch.auth.entity.User;
import com.vouch.auth.repository.UserRepository;
import com.vouch.auth.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final LoginAttemptService loginAttemptService;

    private static final int MAX_ACCOUNT_ATTEMPTS = 5;
    private static final int LOCKOUT_MINUTES = 30;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new RuntimeException("Phone number already registered");
        }
        if (request.getEmail() != null && !request.getEmail().isBlank()
                && userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email address already registered");
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
                .failedLoginAttempts(0)
                .accountLocked(false)
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

    public AuthResponse login(LoginRequest request, String ipAddress) {
        // ✅ Step 1 — Check if IP is blocked due to too many attempts
        if (loginAttemptService.isBlocked(ipAddress)) {
            throw new RuntimeException(
                "Too many failed login attempts from your network. Please try again later."
            );
        }

        User user;

        try {
            if ("email".equals(request.getLoginMethod())) {
                user = userRepository.findByEmail(request.getIdentifier())
                        .orElseThrow(() -> new RuntimeException("No account found with this email address"));

                if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                    handleFailedAttempt(user, ipAddress);
                    throw new RuntimeException("Invalid password");
                }
            } else {
                user = userRepository.findByPhone(request.getIdentifier())
                        .orElseThrow(() -> new RuntimeException("No account found with this phone number"));

                if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                    handleFailedAttempt(user, ipAddress);
                    throw new RuntimeException("Invalid password");
                }
            }
        } catch (RuntimeException e) {
            throw e;
        }

        // ✅ Step 2 — Check if account is locked
        if (user.isCurrentlyLocked()) {
            long minutesLeft = java.time.Duration.between(
                LocalDateTime.now(), user.getAccountLockedUntil()
            ).toMinutes() + 1;
            throw new RuntimeException(
                "Your account is temporarily locked due to too many failed login attempts. " +
                "Please try again in " + minutesLeft + " minutes."
            );
        }

        // ✅ Step 3 — Auto unlock if lockout period has expired
        if (Boolean.TRUE.equals(user.getAccountLocked()) &&
                user.getAccountLockedUntil() != null &&
                LocalDateTime.now().isAfter(user.getAccountLockedUntil())) {
            user.setAccountLocked(false);
            user.setFailedLoginAttempts(0);
            user.setAccountLockedUntil(null);
            userRepository.save(user);
        }

        // ✅ Step 4 — Successful login — reset counters
        user.setFailedLoginAttempts(0);
        user.setAccountLocked(false);
        user.setAccountLockedUntil(null);
        user.setLastActive(LocalDateTime.now());
        userRepository.save(user);

        loginAttemptService.loginSucceeded(ipAddress);

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

    private void handleFailedAttempt(User user, String ipAddress) {
        // Track failed attempt on IP level
        loginAttemptService.loginFailed(ipAddress);

        // Track failed attempt on account level
        int attempts = user.getFailedLoginAttempts() == null ? 0 : user.getFailedLoginAttempts();
        attempts++;
        user.setFailedLoginAttempts(attempts);

        if (attempts >= MAX_ACCOUNT_ATTEMPTS) {
            // Lock the account for 30 minutes
            user.setAccountLocked(true);
            user.setAccountLockedUntil(LocalDateTime.now().plusMinutes(LOCKOUT_MINUTES));
            userRepository.save(user);
            log.warn("Account locked for phone {} after {} failed attempts", user.getPhone(), attempts);
            throw new RuntimeException(
                "Your account has been locked for " + LOCKOUT_MINUTES +
                " minutes due to " + MAX_ACCOUNT_ATTEMPTS + " failed login attempts."
            );
        }

        userRepository.save(user);
        int remaining = MAX_ACCOUNT_ATTEMPTS - attempts;
        throw new RuntimeException(
            "Invalid password. " + remaining + " attempt" + (remaining == 1 ? "" : "s") + " remaining before your account is locked."
        );
    }

    public void savePushToken(String phone, String pushToken) {
        User user = userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setPushToken(pushToken);
        userRepository.save(user);
    }
}