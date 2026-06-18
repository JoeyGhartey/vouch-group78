package com.vouch.expense.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;
import java.util.List;
import java.util.Map;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class SharedExpenseRequest {
    @NotNull(message = "Circle ID is required")
    private Long circleId;
    @NotNull(message = "Description is required")
    private String description;
    @NotNull(message = "Total amount is required") @Positive(message = "Amount must be positive")
    private Double totalAmount;
    private String category;
    @NotNull(message = "Participant IDs are required")
    private List<Long> participantIds;
    private Map<Long, Double> customSplits;
}
