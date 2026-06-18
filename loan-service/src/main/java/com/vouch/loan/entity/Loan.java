package com.vouch.loan.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "loans")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Loan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "borrower_id", nullable = false)
    private Long borrowerId;

    @Column(name = "lender_id")
    private Long lenderId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "circle_id", nullable = false)
    private Circle circle;

    @Column(nullable = false)
    private Double amount;

    @Column(nullable = false)
    private String reason;

    @Builder.Default
    @Column(nullable = false)
    private Double interestRate = 0.0;

    @Builder.Default
    @Column(nullable = false)
    private Double totalRepaymentAmount = 0.0;

    @Builder.Default
    @Column(nullable = false)
    private Double amountRepaid = 0.0;

    @Builder.Default
    @Column(nullable = false)
    private Double overdueInterestAccrued = 0.0;

    @Builder.Default
    @Column(nullable = false)
    private Double dailyOverdueRate = 0.5;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private RepaymentType repaymentType = RepaymentType.FIXED;

    @Column(nullable = false)
    private Integer repaymentPeriodMonths;

    private LocalDateTime dueDate;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private LoanStatus status = LoanStatus.REQUESTED;

    @Builder.Default
    @Column(nullable = false)
    private Boolean isGroupFunded = false;

    @Builder.Default
    @OneToMany(mappedBy = "loan", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<LoanContribution> contributions = new ArrayList<>();

    private LocalDateTime gracePeriodStart;
    private LocalDateTime gracePeriodEnd;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime disbursedAt;
    private LocalDateTime completedAt;
    private LocalDateTime defaultedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum LoanStatus {
        REQUESTED, AGREEMENT_PENDING, AGREEMENT_SIGNED, DISBURSED, ACTIVE,
        DUE, GRACE_PERIOD, REPAID, DEFAULTED, DISPUTED, CANCELLED
    }

    public enum RepaymentType {
        FIXED, FLEXIBLE
    }
}
