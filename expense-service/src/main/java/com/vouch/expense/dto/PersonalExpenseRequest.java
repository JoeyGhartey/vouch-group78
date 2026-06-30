package com.vouch.expense.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class PersonalExpenseRequest {
    @NotNull(message = "Amount is required") @Positive(message = "Amount must be positive")
    private Double amount;
    @NotNull(message = "Description is required")
    private String description;
    @NotNull(message = "Category is required")
    private String category;
    private String type;
    private String transactionDate;
    private Boolean overrideLimit;
}
