package com.vouch.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CircleResponse {
    private Long id;
    private String name;
    private String description;
    private String creatorName;
    private Long creatorId;
    private Double maxLoanAmount;
    private Double groupFundingThreshold;
    private Double minTrustScore;
    private Boolean requireApprovalToJoin;
    private Integer memberCount;
    private List<CircleMemberResponse> members;
    private LocalDateTime createdAt;
}
