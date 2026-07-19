package com.vouch.auth.dto;

import jakarta.validation.constraints.Pattern;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UpdateProfileRequest {
    private String firstName;
    private String lastName;
    private String email;
    private String momoProvider;

    @Pattern(regexp = "^$|^[0-9]{10}$", message = "MoMo number must be exactly 10 digits")
    private String momoNumber;
}
