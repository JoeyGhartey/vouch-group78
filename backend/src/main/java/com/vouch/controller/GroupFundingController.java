package com.vouch.controller;

import com.vouch.service.GroupFundingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/loans/group")
@RequiredArgsConstructor
public class GroupFundingController {

    private final GroupFundingService groupFundingService;

    /**
     * Contribute to a group-funded loan.
     * Body: { "loanId": 1, "amount": 500, "interestRate": 3.0 }
     */
    @PostMapping("/contribute")
    public ResponseEntity<Map<String, Object>> contribute(
            Authentication auth,
            @RequestBody Map<String, Object> body) {
        Long loanId = Long.valueOf(body.get("loanId").toString());
        Double amount = Double.valueOf(body.get("amount").toString());
        Double interestRate = Double.valueOf(body.get("interestRate").toString());
        return ResponseEntity.ok(groupFundingService.contributeToLoan(auth.getName(), loanId, amount, interestRate));
    }

    /**
     * Get all contributions for a loan.
     */
    @GetMapping("/{loanId}/contributions")
    public ResponseEntity<Map<String, Object>> getContributions(
            Authentication auth,
            @PathVariable Long loanId) {
        return ResponseEntity.ok(groupFundingService.getLoanContributions(auth.getName(), loanId));
    }

    /**
     * Sign a group loan agreement.
     */
    @PostMapping("/{loanId}/sign")
    public ResponseEntity<Map<String, Object>> signAgreement(
            Authentication auth,
            @PathVariable Long loanId) {
        return ResponseEntity.ok(groupFundingService.signGroupAgreement(auth.getName(), loanId));
    }

    /**
     * Disburse a group-funded loan.
     * Any contributing lender can trigger this after all parties sign.
     */
    @PostMapping("/{loanId}/disburse")
    public ResponseEntity<Map<String, Object>> disburse(
            Authentication auth,
            @PathVariable Long loanId) {
        return ResponseEntity.ok(groupFundingService.disburseGroupLoan(auth.getName(), loanId));
    }
}
