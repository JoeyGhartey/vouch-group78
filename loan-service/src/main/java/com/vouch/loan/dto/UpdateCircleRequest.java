package com.vouch.loan.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UpdateCircleRequest {
    private String name;
    private String description;
    private Double maxLoanAmount;
    private Double groupFundingThreshold;
    private Double minTrustScore;
    private Boolean requireApprovalToJoin;
}
