package com.vouch.controller;

import com.vouch.dto.PaymentInitResponse;
import com.vouch.service.PaystackService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaystackService paystackService;

    /**
     * Initialize loan disbursement payment.
     * Lender calls this to pay the borrower.
     */
    @PostMapping("/disburse/{loanId}")
    public ResponseEntity<PaymentInitResponse> initializeDisbursement(
            Authentication auth, @PathVariable Long loanId) {
        return ResponseEntity.ok(paystackService.initializeLoanDisbursement(auth.getName(), loanId));
    }

    /**
     * Initialize loan repayment.
     * Borrower calls this to repay the lender.
     */
    @PostMapping("/repay/{loanId}")
    public ResponseEntity<PaymentInitResponse> initializeRepayment(
            Authentication auth,
            @PathVariable Long loanId,
            @RequestBody(required = false) Map<String, Double> body) {
        Double amount = body != null ? body.get("amount") : null;
        return ResponseEntity.ok(paystackService.initializeLoanRepayment(auth.getName(), loanId, amount));
    }

    /**
     * Verify a transaction after payment completes.
     * Frontend calls this after user returns from Paystack.
     */
    @GetMapping("/verify/{reference}")
    public ResponseEntity<Map<String, Object>> verifyTransaction(
            @PathVariable String reference) {
        return ResponseEntity.ok(paystackService.verifyTransaction(reference));
    }

    /**
     * Paystack webhook endpoint.
     * Paystack calls this to notify us of payment events.
     * This must be publicly accessible (no auth required).
     */
    @PostMapping("/webhook")
    public ResponseEntity<String> handleWebhook(@RequestBody String payload) {
        paystackService.handleWebhook(payload);
        return ResponseEntity.ok("OK");
    }
}
