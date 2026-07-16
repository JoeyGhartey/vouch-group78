package com.vouch.dispute.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "disputes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Dispute {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "loan_id", nullable = false)
    private Long loanId;

    @Column(name = "opened_by_id", nullable = false)
    private Long openedById;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String evidence;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private DisputeStatus status = DisputeStatus.OPEN;

    @Column(columnDefinition = "TEXT")
    private String adminNotes;

    @Column(columnDefinition = "TEXT")
    private String resolution;

    @Column(name = "resolved_by_id")
    private Long resolvedById;

    private LocalDateTime resolvedAt;

    // Escalation: a party can manually escalate past their circle owner to a
    // platform admin, or a scheduled job auto-escalates after a timeout.
    // escalatedById is null when the escalation was automatic (timeout).
    @Builder.Default
    @Column(nullable = false)
    private Boolean escalated = false;

    private LocalDateTime escalatedAt;

    @Column(name = "escalated_by_id")
    private Long escalatedById;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum DisputeStatus {
        OPEN, UNDER_REVIEW, RESOLVED_BORROWER_FAVOR, RESOLVED_LENDER_FAVOR, CLOSED
    }
}
