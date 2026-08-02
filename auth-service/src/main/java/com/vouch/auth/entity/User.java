package com.vouch.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String phone;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    @Column(unique = true)
    private String email;

    private String momoProvider;
    private String momoNumber;

    @Builder.Default
    @Column(nullable = false)
    private Double trustScore = 50.0;

    @Builder.Default
    @Column(nullable = false)
    private Integer totalLoansGiven = 0;

    @Builder.Default
    @Column(nullable = false)
    private Integer totalLoansReceived = 0;

    @Builder.Default
    @Column(nullable = false)
    private Integer loansRepaidOnTime = 0;

    @Builder.Default
    @Column(nullable = false)
    private Integer defaults = 0;

    @Builder.Default
    @Column(nullable = false)
    private Boolean borrowingSuspended = false;

    private LocalDateTime borrowingSuspendedUntil;

    @Builder.Default
    @Column(nullable = false)
    private Boolean permanentBan = false;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private Role role = Role.USER;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime lastActive;

    private String pushToken;

    // Password reset OTP
    private String resetOtpHash;
    private LocalDateTime resetOtpExpiry;

    @Builder.Default
    private Integer resetOtpAttempts = 0;

    // Throttles forgotPassword() the same way registration OTPs are already
    // throttled -- without this, forgotPassword had no rate limit at all,
    // so anyone could script repeated calls against a victim's phone/email
    // to spam their inbox/device indefinitely.
    private LocalDateTime resetOtpLastSentAt;

    // ✅ Security: track failed login attempts and lockout
    @Builder.Default
    private Integer failedLoginAttempts = 0;

    private LocalDateTime accountLockedUntil;

    @Builder.Default
    private Boolean accountLocked = false;

    // Soft delete: the row is never physically removed, since loans, circle
    // memberships, and trust-score history in OTHER services still reference
    // this user's id. Deleting it for real would orphan every one of those
    // records. Instead this flag blocks login and the profile/PII fields get
    // anonymized in place, while id/trustScore/loan counters stay intact so
    // other users' history keeps resolving correctly. See AuthService.deleteAccount().
    // Not nullable=false on purpose: Hibernate's schema auto-update can't add
    // a NOT NULL column to a table that already has rows without a DB-level
    // default, and adding one fails/skips silently on Postgres instead of
    // erroring loudly. Nullable is safe here since every check in the code
    // uses Boolean.TRUE.equals(...), which treats a null column the same as
    // false for any row that predates this field.
    @Builder.Default
    private Boolean deleted = false;

    private LocalDateTime deletedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        lastActive = LocalDateTime.now();
    }

    // ✅ Helper: check if account is currently locked
    public boolean isCurrentlyLocked() {
        if (!Boolean.TRUE.equals(accountLocked)) return false;
        if (accountLockedUntil == null) return true;
        if (LocalDateTime.now().isAfter(accountLockedUntil)) {
            // Lock has expired — will be cleared on next login attempt
            return false;
        }
        return true;
    }

    public enum Role {
        USER, ADMIN
    }
}