package com.vouch.loan.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class LoanRequest {

    @NotNull(message = "Circle ID is required")
    private Long circleId;

    @NotNull(message = "Amount is required")
    @Positive(message = "Amount must be positive")
    private Double amount;

    @NotNull(message = "Reason is required")
    private String reason;

    private String repaymentType;
    private Integer repaymentPeriodMonths;
    private String dueDate;
}
