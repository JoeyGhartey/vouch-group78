package com.vouch.auth.service;

import com.vouch.auth.dto.AuthResponse;
import com.vouch.auth.dto.ForgotPasswordRequest;
import com.vouch.auth.dto.LoginRequest;
import com.vouch.auth.dto.RegisterRequest;
import com.vouch.auth.dto.ResendRegistrationOtpRequest;
import com.vouch.auth.dto.ResetPasswordRequest;
import com.vouch.auth.dto.VerifyRegistrationRequest;
import com.vouch.auth.entity.PendingRegistration;
import com.vouch.auth.entity.User;
import com.vouch.auth.repository.PendingRegistrationRepository;
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
    private final PendingRegistrationRepository pendingRegistrationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final LoginAttemptService loginAttemptService;
    private final RestTemplate restTemplate;

    @Value("${sendgrid.api-key}")
    private String sendGridApiKey;

    @Value("${sendgrid.from-email}")
    private String sendGridFromEmail;

    private static final int MAX_ACCOUNT_ATTEMPTS = 5;
    private static final int LOCKOUT_MINUTES = 30;
    private static final int REGISTRATION_OTP_VALID_MINUTES = 10;
    private static final int RESEND_COOLDOWN_SECONDS = 45;

    // Step 1 of registration: nothing is created in `users` yet. Validates
    // uniqueness against real accounts, stashes the (already-hashed) submitted
    // data in a pending row keyed by phone/email, and emails an OTP. If a
    // pending registration for this phone/email already exists (e.g. the
    // person abandoned it and is trying again, or never got the email), it's
    // overwritten with fresh data and a fresh code rather than rejected --
    // rejecting would just trap someone who lost their first email.
    public Map<String, String> initiateRegistration(RegisterRequest request) {
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new RuntimeException("Phone number already registered");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email address already registered");
        }

        PendingRegistration pending = pendingRegistrationRepository.findByPhone(request.getPhone())
                .orElseGet(() -> pendingRegistrationRepository.findByEmail(request.getEmail())
                        .orElseGet(PendingRegistration::new));

        pending.setPhone(request.getPhone());
        pending.setEmail(request.getEmail());
        pending.setPassword(passwordEncoder.encode(request.getPassword()));
        pending.setFirstName(request.getFirstName());
        pending.setLastName(request.getLastName());
        pending.setMomoProvider(request.getMomoProvider());
        pending.setMomoNumber(request.getMomoNumber());

        String otp = String.format("%06d", OTP_RANDOM.nextInt(1_000_000));
        pending.setOtpHash(passwordEncoder.encode(otp));
        pending.setOtpExpiry(LocalDateTime.now().plusMinutes(REGISTRATION_OTP_VALID_MINUTES));
        pending.setOtpAttempts(0);
        pending.setLastOtpSentAt(LocalDateTime.now());

        pendingRegistrationRepository.save(pending);

        sendEmail(request.getEmail(), "Verify your Vouch account",
                "Your Vouch verification code is " + otp + ".\n\n" +
                "It expires in " + REGISTRATION_OTP_VALID_MINUTES + " minutes. If you didn't try to sign up, ignore this email.");

        return Map.of("message", "Check your inbox — we've emailed a 6-digit code to " + request.getEmail() + ". It expires in 10 minutes.");
    }

    // Step 2: only now does the real User row get created.
    public AuthResponse verifyRegistration(VerifyRegistrationRequest request) {
        PendingRegistration pending = pendingRegistrationRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new RuntimeException("No pending registration found for this phone number. Start over from Sign Up."));

        if (pending.getOtpExpiry().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("This code has expired. Request a new one.");
        }
        int attempts = pending.getOtpAttempts() == null ? 0 : pending.getOtpAttempts();
        if (attempts >= 5) {
            pendingRegistrationRepository.delete(pending);
            throw new RuntimeException("Too many incorrect attempts. Start over from Sign Up.");
        }
        if (!passwordEncoder.matches(request.getOtp(), pending.getOtpHash())) {
            pending.setOtpAttempts(attempts + 1);
            pendingRegistrationRepository.save(pending);
            throw new RuntimeException("Incorrect code.");
        }

        // Re-check uniqueness at the finish line too, not just at initiate --
        // someone else could have registered this exact phone/email in the
        // window between initiate and verify.
        if (userRepository.existsByPhone(pending.getPhone())) {
            pendingRegistrationRepository.delete(pending);
            throw new RuntimeException("Phone number already registered");
        }
        if (userRepository.existsByEmail(pending.getEmail())) {
            pendingRegistrationRepository.delete(pending);
            throw new RuntimeException("Email address already registered");
        }

        User user = User.builder()
                .phone(pending.getPhone())
                .password(pending.getPassword())
                .firstName(pending.getFirstName())
                .lastName(pending.getLastName())
                .email(pending.getEmail())
                .momoProvider(pending.getMomoProvider())
                .momoNumber(pending.getMomoNumber())
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
        pendingRegistrationRepository.delete(pending);

        // Best-effort only -- the account already exists at this point, so a
        // welcome-email hiccup must never fail the registration itself.
        try {
            sendEmail(user.getEmail(), "Welcome to Vouch",
                    "Hi " + user.getFirstName() + ",\n\n" +
                    "Your Vouch account has been created successfully. You can now lend, borrow, and split expenses with your circles.\n\n" +
                    "If you didn't create this account, contact support immediately.");
        } catch (Exception e) {
            log.warn("Welcome email failed for {}, account was still created: {}", user.getEmail(), e.getMessage());
        }

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

    public Map<String, String> resendRegistrationOtp(ResendRegistrationOtpRequest request) {
        PendingRegistration pending = pendingRegistrationRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new RuntimeException("No pending registration found for this phone number. Start over from Sign Up."));

        if (pending.getLastOtpSentAt() != null
                && pending.getLastOtpSentAt().plusSeconds(RESEND_COOLDOWN_SECONDS).isAfter(LocalDateTime.now())) {
            long secondsLeft = java.time.Duration.between(LocalDateTime.now(),
                    pending.getLastOtpSentAt().plusSeconds(RESEND_COOLDOWN_SECONDS)).toSeconds() + 1;
            throw new RuntimeException("Please wait " + secondsLeft + " seconds before requesting another code.");
        }

        String otp = String.format("%06d", OTP_RANDOM.nextInt(1_000_000));
        pending.setOtpHash(passwordEncoder.encode(otp));
        pending.setOtpExpiry(LocalDateTime.now().plusMinutes(REGISTRATION_OTP_VALID_MINUTES));
        pending.setOtpAttempts(0);
        pending.setLastOtpSentAt(LocalDateTime.now());
        pendingRegistrationRepository.save(pending);

        sendEmail(pending.getEmail(), "Your new Vouch verification code",
                "Your new Vouch verification code is " + otp + ".\n\n" +
                "It expires in " + REGISTRATION_OTP_VALID_MINUTES + " minutes.");

        return Map.of("message", "A new code has been sent to " + pending.getEmail() + ".");
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
            sendEmail(user.getEmail(), "Vouch password reset code",
                    "Your Vouch password reset code is " + otp + ".\n\n" +
                    "It expires in " + OTP_VALID_MINUTES + " minutes. If you didn't request this, ignore this email.");
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

    // Generic email sender via SendGrid's HTTP API (not SMTP) — Railway blocks
    // outbound SMTP ports on non-Pro plans, but a normal HTTPS POST goes
    // through unaffected. Shared by password-reset OTPs, registration OTPs,
    // and the post-verification welcome email.
    private void sendEmail(String email, String subject, String body) {
        if (sendGridApiKey == null || sendGridApiKey.isBlank()) {
            log.warn("SENDGRID_API_KEY is not configured — cannot send email to {}", email);
            throw new RuntimeException("Email delivery isn't configured yet. Please try again shortly.");
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(sendGridApiKey);

            Map<String, Object> payload = Map.of(
                    "personalizations", List.of(Map.of("to", List.of(Map.of("email", email)))),
                    "from", Map.of("email", sendGridFromEmail, "name", "Vouch"),
                    "subject", subject,
                    "content", List.of(Map.of("type", "text/plain", "value", body))
            );

            restTemplate.postForEntity("https://api.sendgrid.com/v3/mail/send",
                    new HttpEntity<>(payload, headers), String.class);
        } catch (Exception e) {
            log.warn("Failed to email {} ({}): {}", subject, email, e.getMessage());
            throw new RuntimeException("Could not send an email to that address right now. Please try again shortly.");
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