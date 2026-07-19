package com.vouch.auth.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UpdateUserStatsRequest {
    private Double trustScore;
    private Integer loansRepaidOnTime;
    private Integer totalLoansGiven;
    private Integer totalLoansReceived;
    private Integer defaults;
    private Boolean borrowingSuspended;
    private LocalDateTime borrowingSuspendedUntil;
    private Boolean permanentBan;
}
