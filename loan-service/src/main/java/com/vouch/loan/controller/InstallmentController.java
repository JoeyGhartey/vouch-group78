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
    public ResponseEntity<Map<String, Object>> payInstallment(Authentication auth, @PathVariable Long loanId, @RequestBody Map<String, Object> body) {
        Integer installmentNumber = Integer.valueOf(body.get("installmentNumber").toString());
        Double amount = body.containsKey("amount") ? Double.valueOf(body.get("amount").toString()) : null;
        return ResponseEntity.ok(installmentService.payInstallment(auth.getName(), loanId, installmentNumber, amount));
    }
}
