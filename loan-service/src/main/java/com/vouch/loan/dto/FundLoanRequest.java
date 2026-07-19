package com.vouch.loan.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class FundLoanRequest {

    @NotNull(message = "Loan ID is required")
    private Long loanId;

    @NotNull(message = "Interest rate is required")
    private Double interestRate;

    private Double amount;

    // Must be explicitly true for fundLoan to proceed on a loan the system
    // flagged as needing group funding -- never inferred, always an explicit
    // opt-in from the lender taking on the full risk alone.
    private Boolean overrideGroupFunding;
}
