package com.vouch.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CircleMemberResponse {
    private Long userId;
    private String firstName;
    private String lastName;
    private String phone;
    private String status;
    private String memberRole;
    private Double circleTrustScore;
    private Integer loansGivenInCircle;
    private Integer loansReceivedInCircle;
    private Integer loansRepaidInCircle;
    private Integer defaultsInCircle;
}
