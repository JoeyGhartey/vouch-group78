package com.vouch.dispute.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class DisputeResolveRequest {
    @NotNull(message = "Resolution is required")
    private String resolution;
    private String adminNotes;
    @NotNull(message = "Outcome is required: BORROWER_FAVOR or LENDER_FAVOR")
    private String outcome;
}
