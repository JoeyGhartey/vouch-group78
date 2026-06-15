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

    @PostMapping("/disburse/{loanId}")
    public ResponseEntity<PaymentInitResponse> initializeDisbursement(
            Authentication auth, @PathVariable Long loanId) {
        return ResponseEntity.ok(paystackService.initializeLoanDisbursement(auth.getName(), loanId));
    }

    @PostMapping("/repay/{loanId}")
    public ResponseEntity<PaymentInitResponse> initializeRepayment(
            Authentication auth,
            @PathVariable Long loanId,
            @RequestBody(required = false) Map<String, Double> body) {
        Double amount = body != null ? body.get("amount") : null;
        return ResponseEntity.ok(paystackService.initializeLoanRepayment(auth.getName(), loanId, amount));
    }

    @GetMapping("/verify/{reference}")
    public ResponseEntity<Map<String, Object>> verifyTransaction(
            @PathVariable String reference) {
        return ResponseEntity.ok(paystackService.verifyTransaction(reference));
    }

    @PostMapping("/webhook")
    public ResponseEntity<String> handleWebhook(@RequestBody String payload) {
        paystackService.handleWebhook(payload);
        return ResponseEntity.ok("OK");
    }

    @GetMapping("/callback")
    public ResponseEntity<String> handleCallback(
            @RequestParam(required = false) String reference,
            @RequestParam(required = false) String trxref) {
        String html = "<!DOCTYPE html><html><head><title>Payment Complete</title>" +
                "<meta name='viewport' content='width=device-width, initial-scale=1'>" +
                "<style>body{font-family:sans-serif;display:flex;flex-direction:column;" +
                "align-items:center;justify-content:center;height:100vh;margin:0;background:#f8f9fa;}" +
                "h2{color:#16a34a;}p{color:#6b7280;}</style></head>" +
                "<body><h2>&#10003; Payment Complete</h2>" +
                "<p>You can close this window and return to Vouch.</p>" +
                "<script>setTimeout(function(){window.close();},2000);</script></body></html>";
        return ResponseEntity.ok()
                .header("Content-Type", "text/html; charset=UTF-8")
                .body(html);
    }
}