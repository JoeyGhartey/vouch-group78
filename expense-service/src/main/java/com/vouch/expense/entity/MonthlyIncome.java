package com.vouch.expense.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

// One row per user -- unlike SpendingLimit (per-category, many rows), this is
// a single self-declared monthly income figure used to warn the user when
// their expenses are approaching or exceeding what they actually make.
@Entity
@Table(name = "monthly_incomes", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MonthlyIncome {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Double amount;

    @Builder.Default
    @Column(nullable = false)
    private Integer lastNotifiedThreshold = 0;

    @Column(nullable = false)
    private LocalDateTime periodStart;

    @PrePersist
    protected void onCreate() {
        if (periodStart == null) periodStart = LocalDateTime.now();
    }
}
