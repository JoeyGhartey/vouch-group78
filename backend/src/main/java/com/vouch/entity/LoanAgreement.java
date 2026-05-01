package com.vouch.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "loan_agreements")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LoanAgreement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "loan_id", nullable = false, unique = true)
    private Loan loan;

    @Column(nullable = false)
    private String borrowerName;

    @Column(nullable = false)
    private String borrowerPhone;

    @Column(nullable = false)
    private String lenderName;

    @Column(nullable = false)
    private String lenderPhone;

    @Column(nullable = false)
    private Double principalAmount;

    @Column(nullable = false)
    private Double interestRate;

    @Column(nullable = false)
    private Double totalRepaymentAmount;

    @Column(nullable = false)
    private String repaymentType;

    @Column(columnDefinition = "TEXT")
    private String repaymentSchedule;

    @Column(nullable = false)
    private Double dailyOverdueRate;

    @Column(nullable = false)
    private Integer gracePeriodDays;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String termsAndConditions;

    @Builder.Default
    @Column(nullable = false)
    private Boolean borrowerSigned = false;

    private LocalDateTime borrowerSignedAt;

    @Builder.Default
    @Column(nullable = false)
    private Boolean lenderSigned = false;

    private LocalDateTime lenderSignedAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
