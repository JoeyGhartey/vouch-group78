package com.vouch.loan.dto;

import jakarta.validation.constraints.Positive;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UpdateCircleRequest {
    private String name;
    private String description;

    @Positive(message = "Max loan amount must be greater than 0")
    private Double maxLoanAmount;

    @Positive(message = "Group funding threshold must be greater than 0")
    private Double groupFundingThreshold;

    private Double minTrustScore;
    private Boolean requireApprovalToJoin;
}
