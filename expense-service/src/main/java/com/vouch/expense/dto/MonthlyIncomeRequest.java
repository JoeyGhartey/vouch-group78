package com.vouch.expense.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class MonthlyIncomeRequest {
    @NotNull(message = "Monthly income is required") @Positive(message = "Income must be positive")
    private Double amount;
}
