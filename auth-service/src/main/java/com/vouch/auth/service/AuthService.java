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
    private final LoanServiceClient loanServiceClient;
    private final ExpenseServiceClient expenseServiceClient;

    @Value("${brevo.api-key}")
    private String brevoApiKey;

    @Value("${brevo.from-email}")
    private String brevoFromEmail;

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

        // Same cooldown resendRegistrationOtp already enforces -- without it,
        // this endpoint (unlike resend) had no throttle at all, so anyone
        // could script repeated calls against a phone/email to email-bomb
        // that inbox indefinitely, since every call unconditionally sends a
        // fresh OTP email. Only applies once a pending row already exists
        // (i.e. this isn't someone's very first attempt).
        if (pending.getLastOtpSentAt() != null
                && pending.getLastOtpSentAt().plusSeconds(RESEND_COOLDOWN_SECONDS).isAfter(LocalDateTime.now())) {
            long secondsLeft = java.time.Duration.between(LocalDateTime.now(),
                    pending.getLastOtpSentAt().plusSeconds(RESEND_COOLDOWN_SECONDS)).toSeconds() + 1;
            throw new RuntimeException("Please wait " + secondsLeft + " seconds before requesting another code.");
        }

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

        sendEmail(request.getEmail(), "Verify your Vouch account", "Verify your email",
                "Enter this code in the app to finish creating your account. It expires in " + REGISTRATION_OTP_VALID_MINUTES + " minutes. " +
                "If you didn't try to sign up for Vouch, you can safely ignore this email.",
                otp);

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
        //
        // Dispatched via CompletableFuture.runAsync instead of the @Async
        // pattern used elsewhere: sendEmail() is a private method called from
        // within this same class, so Spring's @Async proxy wouldn't intercept
        // it (self-invocation isn't proxied), and sendEmail() is also used by
        // three OTP-carrying flows (initiateRegistration, resendRegistrationOtp,
        // forgotPassword) that deliberately re-throw on failure since the
        // email IS the delivery mechanism for the code -- those must stay
        // synchronous. This wraps only this one best-effort call site, so
        // verifyRegistration's response no longer waits on Brevo before
        // returning the new user their token.
        String welcomeEmail = user.getEmail();
        String welcomeFirstName = user.getFirstName();
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                sendEmail(welcomeEmail, "Welcome to Vouch", "You're all set, " + welcomeFirstName + "!",
                        "Your Vouch account has been created successfully. You can now lend, borrow, and split expenses with the people you trust. " +
                        "If you didn't create this account, please contact support immediately.",
                        null);
            } catch (Exception e) {
                log.warn("Welcome email failed for {}, account was still created: {}", welcomeEmail, e.getMessage());
            }
        });

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

        sendEmail(pending.getEmail(), "Your new Vouch verification code", "Verify your email",
                "Enter this code in the app to finish creating your account. It expires in " + REGISTRATION_OTP_VALID_MINUTES + " minutes.",
                otp);

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

                if (Boolean.TRUE.equals(user.getDeleted())) {
                    throw new RuntimeException("This account has been deleted.");
                }

                if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                    handleFailedAttempt(user, ipAddress);
                    throw new RuntimeException("Invalid password");
                }
            } else {
                user = userRepository.findByPhone(request.getIdentifier())
                        .orElseThrow(() -> new RuntimeException("No account found with this phone number"));

                if (Boolean.TRUE.equals(user.getDeleted())) {
                    throw new RuntimeException("This account has been deleted.");
                }

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
            sendEmail(user.getEmail(), "Vouch password reset code", "Reset your password",
                    "Enter this code in the app to reset your password. It expires in " + OTP_VALID_MINUTES + " minutes. " +
                    "If you didn't request this, you can safely ignore this email.",
                    otp);
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
        if (user.getResetOtpLastSentAt() != null
                && user.getResetOtpLastSentAt().plusSeconds(RESEND_COOLDOWN_SECONDS).isAfter(LocalDateTime.now())) {
            long secondsLeft = java.time.Duration.between(LocalDateTime.now(),
                    user.getResetOtpLastSentAt().plusSeconds(RESEND_COOLDOWN_SECONDS)).toSeconds() + 1;
            throw new RuntimeException("Please wait " + secondsLeft + " seconds before requesting another code.");
        }

        String otp = String.format("%06d", OTP_RANDOM.nextInt(1_000_000));
        user.setResetOtpHash(passwordEncoder.encode(otp));
        user.setResetOtpExpiry(LocalDateTime.now().plusMinutes(OTP_VALID_MINUTES));
        user.setResetOtpAttempts(0);
        user.setResetOtpLastSentAt(LocalDateTime.now());
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

    // Self-service "delete my account" — soft delete only. The row and its
    // id, trustScore, and loan/default counters are kept in place, since
    // loan-service/expense-service/dispute-service/notification-service each
    // have their own database and reference this user only by id/phone
    // copied via internal API calls, not a real foreign key. A hard delete
    // here would orphan every loan, circle membership, and shared-expense
    // record other users still hold that reference this person. Instead:
    // login is blocked (deleted flag + unusable password), and PII (name,
    // email, momo details, push token) is wiped -- but phone stays as-is
    // since it's the unique lookup key other services already have on file.
    //
    // Blocked while the user has money genuinely in motion, mirroring the
    // leave-circle rule but checked across every circle at once: an active
    // loan (as borrower, solo lender, or group-funding contributor) or an
    // unsettled shared expense anywhere. Both checks fail CLOSED (block
    // deletion) if the other service can't be reached, since this action
    // can't be undone from the login side once it succeeds.
    //
    // Known limitation (accepted deliberately, not an oversight): JWTs are
    // stateless and last 30 days, and none of the other five services
    // re-validate user status per request -- only auth-service enforces the
    // deleted flag. A still-valid token from before deletion could keep
    // working against loan-service/expense-service/etc. until it naturally
    // expires. Fixing this fully would mean every service calling back to
    // auth-service on every authenticated request, which wasn't worth the
    // added latency/complexity for this app's timeline and threat model.
    public Map<String, Object> deleteAccount(String phone) {
        User user = userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("Account not found"));

        if (Boolean.TRUE.equals(user.getDeleted())) {
            throw new RuntimeException("This account has already been deleted.");
        }

        if (loanServiceClient.hasActiveLoan(user.getId())) {
            throw new RuntimeException(
                "You have an active loan (as a borrower, lender, or contributor). " +
                "Resolve it before deleting your account."
            );
        }

        if (expenseServiceClient.hasUnsettledExpenses(user.getId())) {
            throw new RuntimeException(
                "You have an unsettled shared expense. Settle up before deleting your account."
            );
        }

        user.setDeleted(true);
        user.setDeletedAt(LocalDateTime.now());
        user.setFirstName("Deleted");
        user.setLastName("User");
        user.setEmail(null);
        user.setMomoProvider(null);
        user.setMomoNumber(null);
        user.setPushToken(null);
        // Unusable password (defense in depth, on top of the deleted-flag
        // check in login()) — a random string run through the same encoder,
        // so even a bug that skipped the deleted check couldn't authenticate.
        user.setPassword(passwordEncoder.encode(java.util.UUID.randomUUID().toString()));
        userRepository.save(user);

        return Map.of("message", "Your account has been deleted.");
    }

    // Generic email sender via Brevo's HTTP API (not SMTP) — Railway blocks
    // outbound SMTP ports on non-Pro plans, but a normal HTTPS POST goes
    // through unaffected. (Previously used SendGrid; that account was
    // permanently banned by SendGrid's fraud/onboarding review, unrelated to
    // this app's code, so this was swapped to Brevo.) Shared by
    // password-reset OTPs, registration OTPs, and the post-verification
    // welcome email. Sends BOTH a plain-text and an HTML part -- besides
    // looking like a real product email instead of a bare string, sending
    // both formats is itself a deliverability signal spam filters weigh;
    // plain-text-only bulk mail is penalized more heavily than a proper
    // multipart message.
    //
    // Note on deliverability: brevoFromEmail is currently a Gmail address,
    // not a domain Vouch controls, so Brevo can't set up SPF/DKIM
    // authentication for it (that requires DNS records on an owned domain).
    // Until this sends from an authenticated custom domain, some inbox
    // providers will still be suspicious of it regardless of how the email
    // itself looks -- branding it properly narrows the gap but doesn't fully
    // close it.
    private void sendEmail(String email, String subject, String heading, String message, String otpCode) {
        if (brevoApiKey == null || brevoApiKey.isBlank()) {
            log.warn("BREVO_API_KEY is not configured — cannot send email to {}", email);
            throw new RuntimeException("Email delivery isn't configured yet. Please try again shortly.");
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("api-key", brevoApiKey);

            String plainTextBody = message + (otpCode != null ? "\n\nYour code: " + otpCode : "");
            String htmlBody = buildBrandedEmailHtml(heading, message, otpCode);

            Map<String, Object> payload = Map.of(
                    "sender", Map.of("email", brevoFromEmail, "name", "Vouch"),
                    "to", List.of(Map.of("email", email)),
                    "subject", subject,
                    "textContent", plainTextBody,
                    "htmlContent", htmlBody
            );

            restTemplate.postForEntity("https://api.brevo.com/v3/smtp/email",
                    new HttpEntity<>(payload, headers), String.class);
        } catch (Exception e) {
            log.warn("Failed to email {} ({}): {}", subject, email, e.getMessage());
            throw new RuntimeException("Could not send an email to that address right now. Please try again shortly.");
        }
    }

    // Inline-styled HTML shell matching the app's black-and-gold branding
    // (same palette as the login/signup screens). Email clients strip
    // <style> blocks and external CSS unpredictably, so every style here is
    // inlined directly on each element rather than relying on a stylesheet.
    private String buildBrandedEmailHtml(String heading, String message, String otpCode) {
        String otpBlock = otpCode == null ? "" : """
                <div style="margin:28px 0;padding:20px;background-color:#f7f5ef;border:1px solid #e5e0d0;border-radius:12px;text-align:center;">
                  <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#111111;font-family:'Courier New',monospace;">%s</span>
                </div>
                """.formatted(otpCode);

        return """
                <!DOCTYPE html>
                <html>
                <body style="margin:0;padding:0;background-color:#f2f2f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f2f2f2;padding:32px 0;">
                    <tr>
                      <td align="center">
                        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;max-width:480px;width:100%%;">
                          <tr>
                            <td style="background-color:#000000;padding:32px 32px 28px 32px;">
                              <span style="color:#C9A84C;font-size:20px;font-weight:800;letter-spacing:4px;">VOUCH</span>
                              <div style="color:#8a8f98;font-size:12px;margin-top:6px;">Inner Circle Lending</div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:32px;">
                              <h1 style="margin:0 0 12px 0;font-size:20px;color:#111111;">%s</h1>
                              <p style="margin:0;font-size:14px;line-height:22px;color:#555555;">%s</p>
                              %s
                              <p style="margin:24px 0 0 0;font-size:12px;line-height:18px;color:#999999;">
                                This is an automated message from Vouch. If you weren't expecting this email, you can safely ignore it.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(heading, message, otpBlock);
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