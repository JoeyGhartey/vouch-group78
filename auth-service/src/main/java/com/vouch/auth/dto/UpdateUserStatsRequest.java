package com.vouch.auth.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UpdateUserStatsRequest {
    private Double trustScore;
    private Integer loansRepaidOnTime;
    private Integer totalLoansGiven;
    private Integer totalLoansReceived;
    private Integer defaults;
}
