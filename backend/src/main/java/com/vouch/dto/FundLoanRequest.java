package com.vouch.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class FundLoanRequest {

    @NotNull(message = "Loan ID is required")
    private Long loanId;

    @NotNull(message = "Interest rate is required")
    private Double interestRate;

    private Double amount;
}
