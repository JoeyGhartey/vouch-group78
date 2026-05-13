package com.vouch.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserProfileResponse {
    private Long id;
    private String phone;
    private String firstName;
    private String lastName;
    private String email;
    private String momoProvider;
    private String momoNumber;
    private Double trustScore;
    private Integer totalLoansGiven;
    private Integer totalLoansReceived;
    private Integer loansRepaidOnTime;
    private Integer defaults;
    private Boolean borrowingSuspended;
    private LocalDateTime borrowingSuspendedUntil;
    private Boolean permanentBan;
    private LocalDateTime createdAt;
    private LocalDateTime lastActive;
}
