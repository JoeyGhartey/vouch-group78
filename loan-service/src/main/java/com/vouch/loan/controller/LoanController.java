package com.vouch.loan.controller;

import com.vouch.loan.dto.FundLoanRequest;
import com.vouch.loan.dto.LoanRequest;
import com.vouch.loan.dto.LoanResponse;
import com.vouch.loan.service.LoanService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/loans")
@RequiredArgsConstructor
public class LoanController {

    private final LoanService loanService;

    @PostMapping("/request")
    public ResponseEntity<LoanResponse> requestLoan(Authentication auth, @Valid @RequestBody LoanRequest request) {
        return ResponseEntity.ok(loanService.requestLoan(auth.getName(), request));
    }

    @PostMapping("/fund")
    public ResponseEntity<LoanResponse> fundLoan(Authentication auth, @Valid @RequestBody FundLoanRequest request) {
        return ResponseEntity.ok(loanService.fundLoan(auth.getName(), request));
    }

    @PostMapping("/{loanId}/sign")
    public ResponseEntity<LoanResponse> signAgreement(Authentication auth, @PathVariable Long loanId) {
        return ResponseEntity.ok(loanService.signAgreement(auth.getName(), loanId));
    }

    @PostMapping("/{loanId}/disburse")
    public ResponseEntity<LoanResponse> disburseLoan(Authentication auth, @PathVariable Long loanId) {
        return ResponseEntity.ok(loanService.disburseLoan(auth.getName(), loanId));
    }

    @PostMapping("/{loanId}/repay")
    public ResponseEntity<LoanResponse> repayLoan(Authentication auth, @PathVariable Long loanId, @RequestBody(required = false) Map<String, Double> body) {
        Double amount = body != null ? body.get("amount") : null;
        return ResponseEntity.ok(loanService.repayLoan(auth.getName(), loanId, amount));
    }

    @PostMapping("/{loanId}/default")
    public ResponseEntity<LoanResponse> defaultLoan(Authentication auth, @PathVariable Long loanId) {
        return ResponseEntity.ok(loanService.defaultLoan(auth.getName(), loanId));
    }

    @PostMapping("/{loanId}/cancel")
    public ResponseEntity<LoanResponse> cancelLoan(Authentication auth, @PathVariable Long loanId) {
        return ResponseEntity.ok(loanService.cancelLoan(auth.getName(), loanId));
    }

    @PostMapping("/{loanId}/reject")
    public ResponseEntity<LoanResponse> rejectAgreement(Authentication auth, @PathVariable Long loanId) {
        return ResponseEntity.ok(loanService.rejectAgreement(loanId, auth.getName()));
    }

    @PostMapping("/{loanId}/counter-offer")
    public ResponseEntity<LoanResponse> proposeCounterOffer(Authentication auth, @PathVariable Long loanId, @RequestBody Map<String, Double> body) {
        return ResponseEntity.ok(loanService.proposeCounterOffer(loanId, auth.getName(), body.get("newRate")));
    }

    @PostMapping("/{loanId}/counter-offer/respond")
    public ResponseEntity<LoanResponse> respondToCounterOffer(Authentication auth, @PathVariable Long loanId, @RequestBody Map<String, Boolean> body) {
        boolean accept = Boolean.TRUE.equals(body.get("accept"));
        return ResponseEntity.ok(loanService.respondToCounterOffer(loanId, auth.getName(), accept));
    }

    @GetMapping("/circle/{circleId}")
    public ResponseEntity<List<LoanResponse>> getCircleLoans(Authentication auth, @PathVariable Long circleId) {
        return ResponseEntity.ok(loanService.getCircleLoans(auth.getName(), circleId));
    }

    @GetMapping("/circle/{circleId}/requests")
    public ResponseEntity<List<LoanResponse>> getCircleLoanRequests(Authentication auth, @PathVariable Long circleId) {
        return ResponseEntity.ok(loanService.getCircleLoanRequests(auth.getName(), circleId));
    }

    @GetMapping("/borrowed")
    public ResponseEntity<List<LoanResponse>> getMyBorrowedLoans(Authentication auth) {
        return ResponseEntity.ok(loanService.getMyLoansAsBorrower(auth.getName()));
    }

    @GetMapping("/lent")
    public ResponseEntity<List<LoanResponse>> getMyLentLoans(Authentication auth) {
        return ResponseEntity.ok(loanService.getMyLoansAsLender(auth.getName()));
    }

    @GetMapping("/{loanId}")
    public ResponseEntity<LoanResponse> getLoan(Authentication auth, @PathVariable Long loanId) {
        return ResponseEntity.ok(loanService.getLoan(auth.getName(), loanId));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "running",
            "service", "loan-service",
            "version", "1.0"
        ));
    }
}
