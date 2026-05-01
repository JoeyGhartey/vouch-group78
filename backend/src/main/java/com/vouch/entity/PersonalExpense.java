package com.vouch.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "personal_expenses")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PersonalExpense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private Double amount;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private String category;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private TransactionType type = TransactionType.EXPENSE;

    @Column(nullable = false)
    private LocalDateTime transactionDate;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (transactionDate == null) {
            transactionDate = LocalDateTime.now();
        }
    }

    public enum TransactionType {
        INCOME, EXPENSE
    }
}
