package com.vouch.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class VerifyRegistrationRequest {
    @NotBlank(message = "Phone number is required")
    private String phone;

    @NotBlank(message = "The code we emailed you is required")
    private String otp;
}
