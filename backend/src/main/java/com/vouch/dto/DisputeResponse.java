package com.vouch.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DisputeResponse {
    private Long id;
    private Long loanId;
    private Double loanAmount;
    private String borrowerName;
    private String lenderName;
    private String openedByName;
    private String reason;
    private String evidence;
    private String status;
    private String adminNotes;
    private String resolution;
    private String resolvedByName;
    private LocalDateTime resolvedAt;
    private LocalDateTime createdAt;
    private String message;
}
