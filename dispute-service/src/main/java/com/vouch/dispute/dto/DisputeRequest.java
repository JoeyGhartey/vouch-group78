package com.vouch.dispute.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class DisputeRequest {
    @NotNull(message = "Loan ID is required")
    private Long loanId;
    @NotNull(message = "Reason is required")
    private String reason;
    private String evidence;
}
