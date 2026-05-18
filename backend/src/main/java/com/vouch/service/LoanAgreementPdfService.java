package com.vouch.service;

import com.vouch.entity.*;
import com.vouch.repository.*;
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
    private final UserRepository userRepository;
    private final CircleMemberRepository circleMemberRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMMM yyyy, HH:mm");

    /**
     * Generate a PDF-like text document for the loan agreement.
     * Uses plain text format that can be saved as .txt or converted.
     * For a real PDF, you'd use iText or Apache PDFBox.
     */
    public byte[] generateAgreementPdf(String phone, Long loanId) {
        User requester = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        // Verify requester is a party to this loan
        boolean isBorrower = requester.getId().equals(loan.getBorrower().getId());
        boolean isLender = loan.getLender() != null && requester.getId().equals(loan.getLender().getId());
        boolean isContributor = loanContributionRepository.findByLoanAndLender(loan, requester).isPresent();

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

        // Parties Section
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
                writer.println("    Lender " + (i + 1) + ":");
                writer.println("      Name:     " + c.getLender().getFirstName() + " " + c.getLender().getLastName());
                writer.println("      Phone:    " + c.getLender().getPhone());
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

        // Loan Details Section
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

        // Repayment Schedule
        if (agreement.getRepaymentSchedule() != null && !agreement.getRepaymentSchedule().isEmpty()) {
            writer.println(thinBorder);
            writer.println("  REPAYMENT SCHEDULE");
            writer.println(thinBorder);
            writer.println();
            writer.println("  " + agreement.getRepaymentSchedule().replace("\n", "\n  "));
            writer.println();
        }

        // Terms and Conditions
        writer.println(thinBorder);
        writer.println("  TERMS AND CONDITIONS");
        writer.println(thinBorder);
        writer.println();
        writer.println("  " + agreement.getTermsAndConditions().replace("\n", "\n  "));
        writer.println();

        // Default Consequences
        writer.println(thinBorder);
        writer.println("  DEFAULT CONSEQUENCES");
        writer.println(thinBorder);
        writer.println();
        writer.println("  1st Default: Trust score reduction (-15 points) and notification");
        writer.println("               to all circle members.");
        writer.println();
        writer.println("  2nd Default: 30-day borrowing suspension and further trust score");
        writer.println("               reduction (-15 points).");
        writer.println();
        writer.println("  3rd Default: Permanent ban from borrowing on the platform.");
        writer.println();

        // Signatures
        writer.println(thinBorder);
        writer.println("  DIGITAL SIGNATURES");
        writer.println(thinBorder);
        writer.println();
        writer.println("  BORROWER: " + agreement.getBorrowerName());
        if (agreement.getBorrowerSigned()) {
            writer.println("    Status:    SIGNED ✓");
            writer.println("    Signed at: " + agreement.getBorrowerSignedAt().format(DATE_FMT));
        } else {
            writer.println("    Status:    PENDING ✗");
        }
        writer.println();

        if (loan.getIsGroupFunded()) {
            writer.println("  LENDERS (Group):");
            if (agreement.getLenderSigned()) {
                writer.println("    Status:    SIGNED ✓");
                writer.println("    Signed at: " + agreement.getLenderSignedAt().format(DATE_FMT));
            } else {
                writer.println("    Status:    PENDING ✗");
            }
        } else {
            writer.println("  LENDER: " + agreement.getLenderName());
            if (agreement.getLenderSigned()) {
                writer.println("    Status:    SIGNED ✓");
                writer.println("    Signed at: " + agreement.getLenderSignedAt().format(DATE_FMT));
            } else {
                writer.println("    Status:    PENDING ✗");
            }
        }
        writer.println();

        // Current Status
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

        // Footer
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

    private User getUserByPhone(String phone) {
        return userRepository.findByPhone(phone).orElseThrow(() -> new RuntimeException("User not found"));
    }
}
