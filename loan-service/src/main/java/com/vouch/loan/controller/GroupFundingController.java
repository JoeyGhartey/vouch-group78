package com.vouch.loan.controller;

import com.vouch.loan.service.GroupFundingService;
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

    @PostMapping("/contribute")
    public ResponseEntity<Map<String, Object>> contribute(Authentication auth, @RequestBody(required = false) Map<String, Object> body) {
        if (body == null || body.get("loanId") == null || body.get("amount") == null || body.get("interestRate") == null) {
            throw new RuntimeException("loanId, amount and interestRate are required");
        }
        Long loanId;
        Double amount;
        Double interestRate;
        try {
            loanId = Long.valueOf(body.get("loanId").toString());
            amount = Double.valueOf(body.get("amount").toString());
            interestRate = Double.valueOf(body.get("interestRate").toString());
        } catch (NumberFormatException e) {
            throw new RuntimeException("loanId, amount and interestRate must be valid numbers");
        }
        return ResponseEntity.ok(groupFundingService.contributeToLoan(auth.getName(), loanId, amount, interestRate));
    }

    @GetMapping("/{loanId}/contributions")
    public ResponseEntity<Map<String, Object>> getContributions(Authentication auth, @PathVariable Long loanId) {
        return ResponseEntity.ok(groupFundingService.getLoanContributions(auth.getName(), loanId));
    }

    @PostMapping("/{loanId}/sign")
    public ResponseEntity<Map<String, Object>> signAgreement(Authentication auth, @PathVariable Long loanId) {
        return ResponseEntity.ok(groupFundingService.signGroupAgreement(auth.getName(), loanId));
    }

    @PostMapping("/{loanId}/disburse")
    public ResponseEntity<Map<String, Object>> disburse(Authentication auth, @PathVariable Long loanId) {
        return ResponseEntity.ok(groupFundingService.disburseGroupLoan(auth.getName(), loanId));
    }
}
