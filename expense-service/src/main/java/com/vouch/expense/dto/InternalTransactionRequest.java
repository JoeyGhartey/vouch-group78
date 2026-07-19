package com.vouch.expense.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class InternalTransactionRequest {
    @NotNull(message = "userId is required")
    private Long userId;
    @NotNull(message = "Description is required")
    private String description;
    @NotNull(message = "Amount is required") @Positive(message = "Amount must be positive")
    private Double amount;
    @NotNull(message = "Category is required")
    private String category;
    @NotNull(message = "Type is required")
    private String type;
}
