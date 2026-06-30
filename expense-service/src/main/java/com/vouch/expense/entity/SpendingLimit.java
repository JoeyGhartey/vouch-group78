package com.vouch.expense.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "spending_limits", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "category"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SpendingLimit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private Double monthlyLimit;

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
