package com.vouch.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationType type;

    private Long referenceId;

    @Builder.Default
    @Column(nullable = false)
    private Boolean read = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum NotificationType {
        LOAN_REQUESTED, LOAN_FUNDED, LOAN_AGREEMENT_READY, LOAN_AGREEMENT_SIGNED,
        LOAN_DISBURSED, LOAN_REPAYMENT_REMINDER, LOAN_REPAID, LOAN_OVERDUE,
        LOAN_GRACE_PERIOD, LOAN_DEFAULTED, LOAN_CANCELLED,
        CIRCLE_INVITE, CIRCLE_MEMBER_APPROVED, CIRCLE_MEMBER_REMOVED,
        SHARED_EXPENSE_CREATED, SHARED_EXPENSE_SETTLED,
        DISPUTE_OPENED, DISPUTE_RESOLVED,
        SPENDING_LIMIT_WARNING, TRUST_SCORE_CHANGED
    }
}
