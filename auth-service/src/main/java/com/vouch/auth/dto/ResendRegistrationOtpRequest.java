package com.vouch.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ResendRegistrationOtpRequest {
    @NotBlank(message = "Phone number is required")
    private String phone;
}
