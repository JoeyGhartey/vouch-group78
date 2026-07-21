package com.vouch.loan.controller;

import com.vouch.loan.service.GroupFundingService;
import com.vouch.loan.service.LoanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/internal/loans")
@RequiredArgsConstructor
public class InternalLoanController {

    private final LoanService loanService;
    private final GroupFundingService groupFundingService;

    @GetMapping("/{loanId}")
    public ResponseEntity<Map<String, Object>> getLoanDetails(@PathVariable Long loanId) {
        return ResponseEntity.ok(loanService.getInternalLoanDetails(loanId));
    }

    @PostMapping("/{loanId}/disburse-complete")
    public ResponseEntity<Map<String, Object>> completeDisbursement(@PathVariable Long loanId) {
        return ResponseEntity.ok(loanService.completeDisbursement(loanId));
    }

    @PostMapping("/{loanId}/repay-complete")
    public ResponseEntity<Map<String, Object>> completeRepayment(
            @PathVariable Long loanId, @RequestBody(required = false) Map<String, Double> body) {
        return ResponseEntity.ok(loanService.completeRepayment(loanId, body != null ? body.get("amount") : null));
    }

    @PostMapping("/{loanId}/group-contribution-paid")
    public ResponseEntity<Map<String, Object>> markGroupContributionPaid(
            @PathVariable Long loanId, @RequestBody Map<String, Object> body) {
        Long lenderId = Long.valueOf(body.get("lenderId").toString());
        groupFundingService.markContributionPaid(loanId, lenderId);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @PostMapping("/{loanId}/set-disputed")
    public ResponseEntity<Map<String, Object>> setDisputed(@PathVariable Long loanId) {
        return ResponseEntity.ok(loanService.setLoanDisputed(loanId));
    }

    @PostMapping("/{loanId}/resolve-dispute")
    public ResponseEntity<Map<String, Object>> resolveDispute(@PathVariable Long loanId) {
        return ResponseEntity.ok(loanService.resolveLoanDispute(loanId));
    }
}
