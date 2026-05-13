package com.vouch.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "loan_installments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LoanInstallment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "loan_id", nullable = false)
    private Loan loan;

    @Column(nullable = false)
    private Integer installmentNumber;

    @Column(nullable = false)
    private Double amountDue;

    @Builder.Default
    @Column(nullable = false)
    private Double amountPaid = 0.0;

    @Column(nullable = false)
    private LocalDateTime dueDate;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InstallmentStatus status = InstallmentStatus.PENDING;

    private LocalDateTime paidAt;

    public enum InstallmentStatus {
        PENDING, PAID, OVERDUE, PARTIALLY_PAID
    }
}
