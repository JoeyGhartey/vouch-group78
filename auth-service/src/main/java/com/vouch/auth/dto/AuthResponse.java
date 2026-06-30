package com.vouch.auth.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuthResponse {
    private String token;
    private String phone;
    private String firstName;
    private String lastName;
    private Double trustScore;
    private String message;
}
