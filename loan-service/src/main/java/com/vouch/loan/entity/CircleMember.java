package com.vouch.loan.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "circle_members", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"circle_id", "user_id"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CircleMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "circle_id", nullable = false)
    private Circle circle;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private MemberStatus status = MemberStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private MemberRole memberRole = MemberRole.MEMBER;

    @Builder.Default
    @Column(nullable = false)
    private Double circleTrustScore = 50.0;

    @Builder.Default
    @Column(nullable = false)
    private Integer loansGivenInCircle = 0;

    @Builder.Default
    @Column(nullable = false)
    private Integer loansReceivedInCircle = 0;

    @Builder.Default
    @Column(nullable = false)
    private Integer loansRepaidInCircle = 0;

    @Builder.Default
    @Column(nullable = false)
    private Integer defaultsInCircle = 0;

    @Column(nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    @PrePersist
    protected void onCreate() {
        joinedAt = LocalDateTime.now();
    }

    public enum MemberStatus {
        PENDING, ACTIVE, REMOVED
    }

    public enum MemberRole {
        CREATOR, ADMIN, MEMBER
    }
}
