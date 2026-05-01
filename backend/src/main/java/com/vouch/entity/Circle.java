package com.vouch.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "circles")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Circle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creator_id", nullable = false)
    private User creator;

    @Builder.Default
    @Column(nullable = false)
    private Double maxLoanAmount = 5000.0;

    @Builder.Default
    @Column(nullable = false)
    private Double groupFundingThreshold = 3000.0;

    @Builder.Default
    @Column(nullable = false)
    private Double minTrustScore = 0.0;

    @Builder.Default
    @Column(nullable = false)
    private Boolean requireApprovalToJoin = true;

    @Builder.Default
    @OneToMany(mappedBy = "circle", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<CircleMember> members = new HashSet<>();

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
