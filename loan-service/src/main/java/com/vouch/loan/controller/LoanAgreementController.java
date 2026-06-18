package com.vouch.loan.controller;

import com.vouch.loan.service.LoanAgreementPdfService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/loans")
@RequiredArgsConstructor
public class LoanAgreementController {

    private final LoanAgreementPdfService loanAgreementPdfService;

    @GetMapping("/{loanId}/agreement/download")
    public ResponseEntity<byte[]> downloadAgreement(Authentication auth, @PathVariable Long loanId) {
        byte[] pdfBytes = loanAgreementPdfService.generateAgreementPdf(auth.getName(), loanId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_PLAIN);
        headers.setContentDispositionFormData("attachment", "Vouch_Loan_Agreement_" + loanId + ".txt");
        headers.setContentLength(pdfBytes.length);

        return ResponseEntity.ok().headers(headers).body(pdfBytes);
    }
}
