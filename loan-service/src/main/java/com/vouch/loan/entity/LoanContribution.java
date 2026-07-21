package com.vouch.loan.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "loan_contributions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LoanContribution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "loan_id", nullable = false)
    private Loan loan;

    @Column(name = "lender_id", nullable = false)
    private Long lenderId;

    @Column(nullable = false)
    private Double amount;

    @Column(nullable = false)
    private Double interestRate;

    @Builder.Default
    @Column(nullable = false)
    private Double amountRepaid = 0.0;

    // Each contributor signs individually -- the loan only becomes
    // AGREEMENT_SIGNED once every contributor here has signed=true AND the
    // borrower has signed, not just any one of them (see GroupFundingService.signGroupAgreement).
    //
    // Intentionally nullable at the DB level (not nullable=false): forcing
    // NOT NULL here means Hibernate's schema auto-update can't add this column
    // to a table that already has rows, since Postgres refuses a NOT NULL
    // column with no default on existing data. Every read already treats
    // null the same as false via Boolean.TRUE.equals(...), so this is safe.
    @Builder.Default
    private Boolean signed = false;

    private LocalDateTime signedAt;

    // Set once this contributor's Paystack payment for their pledged share
    // has been verified -- happens after everyone has signed, not at pledge
    // time. Nullable for the same reason as `signed`: adding a NOT NULL
    // column to a table with existing rows fails in Postgres.
    @Builder.Default
    private Boolean paid = false;

    private LocalDateTime paidAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime contributedAt;

    @PrePersist
    protected void onCreate() {
        contributedAt = LocalDateTime.now();
    }
}
