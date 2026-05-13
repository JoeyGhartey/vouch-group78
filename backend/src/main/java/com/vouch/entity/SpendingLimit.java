package com.vouch.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "spending_limits", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "category"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SpendingLimit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private Double monthlyLimit;
}
