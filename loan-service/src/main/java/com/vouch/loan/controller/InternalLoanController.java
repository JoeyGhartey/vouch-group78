package com.vouch.loan.controller;

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
            @PathVariable Long loanId, @RequestBody Map<String, Double> body) {
        return ResponseEntity.ok(loanService.completeRepayment(loanId, body.get("amount")));
    }

    @PostMapping("/{loanId}/set-disputed")
    public ResponseEntity<Map<String, Object>> setDisputed(@PathVariable Long loanId) {
        return ResponseEntity.ok(loanService.setLoanDisputed(loanId));
    }
}
