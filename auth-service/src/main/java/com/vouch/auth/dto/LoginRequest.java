package com.vouch.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class LoginRequest {

    @NotBlank(message = "Please enter your phone number or email address")
    private String identifier;

    // "phone" or "email"
    private String loginMethod;

    @NotBlank(message = "Please enter your password")
    private String password;
}