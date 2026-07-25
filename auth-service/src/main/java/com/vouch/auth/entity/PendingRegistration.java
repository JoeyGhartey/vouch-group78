package com.vouch.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

// Holds a registration that hasn't been email-verified yet. Nothing in the
// `users` table is created until the OTP stored here is confirmed via
// /api/auth/register/verify -- this row IS the account until that happens.
// The password is already bcrypt-hashed before it ever lands here, same as
// it would be on the real User entity; we never hold a plaintext password,
// even temporarily. Cleared out either by successful verification (row is
// deleted and a real User is created) or by the scheduled cleanup job for
// anyone who abandons the flow (see RegistrationCleanupService).
@Entity
@Table(name = "pending_registrations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PendingRegistration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String phone;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    private String momoProvider;
    private String momoNumber;

    @Column(nullable = false)
    private String otpHash;

    @Column(nullable = false)
    private LocalDateTime otpExpiry;

    @Builder.Default
    private Integer otpAttempts = 0;

    // Gates /register/resend so it can't be hammered to spam SendGrid sends.
    private LocalDateTime lastOtpSentAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
