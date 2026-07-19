package com.vouch.loan.controller;

import com.vouch.loan.service.InstallmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/loans")
@RequiredArgsConstructor
public class InstallmentController {

    private final InstallmentService installmentService;

    @GetMapping("/{loanId}/installments")
    public ResponseEntity<Map<String, Object>> getInstallments(Authentication auth, @PathVariable Long loanId) {
        return ResponseEntity.ok(installmentService.getInstallments(auth.getName(), loanId));
    }

    @PostMapping("/{loanId}/installments/pay")
    public ResponseEntity<Map<String, Object>> payInstallment(Authentication auth, @PathVariable Long loanId, @RequestBody(required = false) Map<String, Object> body) {
        if (body == null || body.get("installmentNumber") == null) {
            throw new RuntimeException("installmentNumber is required");
        }
        Integer installmentNumber;
        Double amount;
        try {
            installmentNumber = Integer.valueOf(body.get("installmentNumber").toString());
            amount = body.get("amount") != null ? Double.valueOf(body.get("amount").toString()) : null;
        } catch (NumberFormatException e) {
            throw new RuntimeException("installmentNumber and amount must be valid numbers");
        }
        return ResponseEntity.ok(installmentService.payInstallment(auth.getName(), loanId, installmentNumber, amount));
    }
}
