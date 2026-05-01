package com.vouch.entity;

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lender_id", nullable = false)
    private User lender;

    @Column(nullable = false)
    private Double amount;

    @Column(nullable = false)
    private Double interestRate;

    @Builder.Default
    @Column(nullable = false)
    private Double amountRepaid = 0.0;

    @Column(nullable = false, updatable = false)
    private LocalDateTime contributedAt;

    @PrePersist
    protected void onCreate() {
        contributedAt = LocalDateTime.now();
    }
}
