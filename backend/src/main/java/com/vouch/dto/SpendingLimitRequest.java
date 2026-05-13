package com.vouch.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class SpendingLimitRequest {
    @NotNull(message = "Category is required")
    private String category;
    @NotNull(message = "Monthly limit is required")
    @Positive(message = "Limit must be positive")
    private Double monthlyLimit;
}
