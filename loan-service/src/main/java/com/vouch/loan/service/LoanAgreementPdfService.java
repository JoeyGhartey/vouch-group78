package com.vouch.loan.service;

import com.vouch.loan.entity.*;
import com.vouch.loan.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class LoanAgreementPdfService {

    private final LoanRepository loanRepository;
    private final LoanAgreementRepository loanAgreementRepository;
    private final LoanContributionRepository loanContributionRepository;
    private final AuthServiceClient authServiceClient;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMMM yyyy, HH:mm");

    public byte[] generateAgreementPdf(String phone, Long loanId) {
        Long requesterId = authServiceClient.getUserIdByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        boolean isBorrower = requesterId.equals(loan.getBorrowerId());
        boolean isLender = loan.getLenderId() != null && requesterId.equals(loan.getLenderId());
        boolean isContributor = loanContributionRepository.findByLoanAndLenderId(loan, requesterId).isPresent();

        if (!isBorrower && !isLender && !isContributor) {
            throw new RuntimeException("You are not a party to this loan");
        }

        LoanAgreement agreement = loanAgreementRepository.findByLoan(loan)
                .orElseThrow(() -> new RuntimeException("No agreement found for this loan"));

        return buildPdfBytes(loan, agreement);
    }

    private byte[] buildPdfBytes(Loan loan, LoanAgreement agreement) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PrintWriter writer = new PrintWriter(baos);

        String border = "════════════════════════════════════════════════════════════════";
        String thinBorder = "────────────────────────────────────────────────────────────────";

        writer.println(border);
        writer.println("                      VOUCH LOAN AGREEMENT");
        writer.println("                   Digital Loan Agreement Document");
        writer.println(border);
        writer.println();
        writer.println("Agreement ID: VOUCH-AGR-" + agreement.getId());
        writer.println("Date Created: " + agreement.getCreatedAt().format(DATE_FMT));
        writer.println("Circle: " + loan.getCircle().getName());
        writer.println();

        writer.println(thinBorder);
        writer.println("  PARTIES TO THIS AGREEMENT");
        writer.println(thinBorder);
        writer.println();
        writer.println("  BORROWER:");
        writer.println("    Name:  " + agreement.getBorrowerName());
        writer.println("    Phone: " + agreement.getBorrowerPhone());
        writer.println();

        if (loan.getIsGroupFunded()) {
            writer.println("  LENDERS (Group Funded):");
            List<LoanContribution> contributions = loanContributionRepository.findByLoan(loan);
            for (int i = 0; i < contributions.size(); i++) {
                LoanContribution c = contributions.get(i);
                String lenderName = authServiceClient.getUserName(c.getLenderId());
                String lenderPhone = authServiceClient.getUserPhone(c.getLenderId());
                writer.println("    Lender " + (i + 1) + ":");
                writer.println("      Name:     " + lenderName);
                writer.println("      Phone:    " + lenderPhone);
                writer.println("      Amount:   GHS " + String.format("%.2f", c.getAmount()));
                writer.println("      Interest: " + c.getInterestRate() + "%");
                writer.println("      Repayment Due: GHS " + String.format("%.2f", c.getAmount() * (1 + c.getInterestRate() / 100)));
                writer.println();
            }
        } else {
            writer.println("  LENDER:");
            writer.println("    Name:  " + agreement.getLenderName());
            writer.println("    Phone: " + agreement.getLenderPhone());
            writer.println();
        }

        writer.println(thinBorder);
        writer.println("  LOAN DETAILS");
        writer.println(thinBorder);
        writer.println();
        writer.println("  Principal Amount:     GHS " + String.format("%.2f", agreement.getPrincipalAmount()));
        writer.println("  Interest Rate:        " + agreement.getInterestRate() + "%");
        if (loan.getIsGroupFunded()) {
            writer.println("  (Weighted Average of Group Contributions)");
        }
        writer.println("  Total Repayment:      GHS " + String.format("%.2f", agreement.getTotalRepaymentAmount()));
        writer.println("  Repayment Type:       " + agreement.getRepaymentType());
        writer.println("  Loan Period:          " + loan.getRepaymentPeriodMonths() + " month(s)");
        if (loan.getDueDate() != null) {
            writer.println("  Due Date:             " + loan.getDueDate().format(DATE_FMT));
        }
        writer.println("  Grace Period:         " + agreement.getGracePeriodDays() + " days");
        writer.println("  Daily Overdue Rate:   " + agreement.getDailyOverdueRate() + "%");
        writer.println();

        if (agreement.getRepaymentSchedule() != null && !agreement.getRepaymentSchedule().isEmpty()) {
            writer.println(thinBorder);
            writer.println("  REPAYMENT SCHEDULE");
            writer.println(thinBorder);
            writer.println();
            writer.println("  " + agreement.getRepaymentSchedule().replace("\n", "\n  "));
            writer.println();
        }

        writer.println(thinBorder);
        writer.println("  TERMS AND CONDITIONS");
        writer.println(thinBorder);
        writer.println();
        writer.println("  " + agreement.getTermsAndConditions().replace("\n", "\n  "));
        writer.println();

        writer.println(thinBorder);
        writer.println("  DIGITAL SIGNATURES");
        writer.println(thinBorder);
        writer.println();
        writer.println("  BORROWER: " + agreement.getBorrowerName());
        if (agreement.getBorrowerSigned()) {
            writer.println("    Status:    SIGNED");
            writer.println("    Signed at: " + agreement.getBorrowerSignedAt().format(DATE_FMT));
        } else {
            writer.println("    Status:    PENDING");
        }
        writer.println();

        if (loan.getIsGroupFunded()) {
            writer.println("  LENDERS (Group):");
        } else {
            writer.println("  LENDER: " + agreement.getLenderName());
        }
        if (agreement.getLenderSigned()) {
            writer.println("    Status:    SIGNED");
            writer.println("    Signed at: " + agreement.getLenderSignedAt().format(DATE_FMT));
        } else {
            writer.println("    Status:    PENDING");
        }
        writer.println();

        writer.println(thinBorder);
        writer.println("  LOAN STATUS");
        writer.println(thinBorder);
        writer.println();
        writer.println("  Current Status: " + loan.getStatus().name());
        if (loan.getDisbursedAt() != null) {
            writer.println("  Disbursed:      " + loan.getDisbursedAt().format(DATE_FMT));
        }
        writer.println("  Amount Repaid:  GHS " + String.format("%.2f", loan.getAmountRepaid()));
        double remaining = loan.getTotalRepaymentAmount() + loan.getOverdueInterestAccrued() - loan.getAmountRepaid();
        writer.println("  Remaining:      GHS " + String.format("%.2f", Math.max(0, remaining)));
        if (loan.getOverdueInterestAccrued() > 0) {
            writer.println("  Overdue Interest: GHS " + String.format("%.2f", loan.getOverdueInterestAccrued()));
        }
        if (loan.getCompletedAt() != null) {
            writer.println("  Completed:      " + loan.getCompletedAt().format(DATE_FMT));
        }
        writer.println();

        writer.println(border);
        writer.println("  This is a digitally generated loan agreement from the Vouch");
        writer.println("  P2P Micro-Lending Platform. Both parties have agreed to the");
        writer.println("  terms above by digitally signing this document.");
        writer.println();
        writer.println("  Generated: " + java.time.LocalDateTime.now().format(DATE_FMT));
        writer.println("  Document Reference: VOUCH-AGR-" + agreement.getId());
        writer.println(border);

        writer.flush();
        return baos.toByteArray();
    }
}
