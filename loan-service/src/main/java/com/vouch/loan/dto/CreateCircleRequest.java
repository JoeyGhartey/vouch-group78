package com.vouch.loan.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class CreateCircleRequest {

    @NotBlank(message = "Circle name is required")
    private String name;

    private String description;
    private Double maxLoanAmount;
    private Double groupFundingThreshold;
    private Double minTrustScore;
    private Boolean requireApprovalToJoin;
}
