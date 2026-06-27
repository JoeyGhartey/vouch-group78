package com.vouch.auth.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class LoginRequest {
    // Can be either a phone number or email address
    private String identifier;
    private String loginMethod; // "phone" or "email"
    private String password;
}
