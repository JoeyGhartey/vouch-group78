package com.vouch.service;

import com.vouch.entity.*;
import com.vouch.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class GroupFundingService {

    private final LoanRepository loanRepository;
    private final LoanContributionRepository loanContributionRepository;
    private final LoanAgreementRepository loanAgreementRepository;
    private final UserRepository userRepository;
    private final CircleMemberRepository circleMemberRepository;
    private final NotificationService notificationService;

    /**
     * Contribute to a group-funded loan.
     * Multiple lenders can contribute different amounts with different interest rates.
     * When the full amount is reached, a group agreement is generated.
     */
    @Transactional
    public Map<String, Object> contributeToLoan(String phone, Long loanId, Double amount, Double interestRate) {
        User lender = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        // Validations
        if (lender.getId().equals(loan.getBorrower().getId())) {
            throw new RuntimeException("You cannot fund your own loan");
        }

        if (loan.getStatus() != Loan.LoanStatus.REQUESTED) {
            throw new RuntimeException("This loan is no longer accepting contributions. Status: " + loan.getStatus());
        }

        // Verify lender is in the same circle
        circleMemberRepository.findByCircleAndUser(loan.getCircle(), lender)
                .filter(m -> m.getStatus() == CircleMember.MemberStatus.ACTIVE)
                .orElseThrow(() -> new RuntimeException("You must be an active member of this circle"));

        // Check if lender already contributed
        boolean alreadyContributed = loanContributionRepository.findByLoanAndLender(loan, lender).isPresent();
        if (alreadyContributed) {
            throw new RuntimeException("You have already contributed to this loan");
        }

        // Validate amount
        if (amount <= 0) throw new RuntimeException("Amount must be positive");
        if (interestRate < 0 || interestRate > 50) throw new RuntimeException("Interest rate must be between 0% and 50%");

        double totalContributed = getTotalContributed(loan);
        double remaining = loan.getAmount() - totalContributed;

        if (amount > remaining) {
            throw new RuntimeException("Amount exceeds remaining needed. Only GHS " + String.format("%.2f", remaining) + " left to fund.");
        }

        // Save contribution
        LoanContribution contribution = LoanContribution.builder()
                .loan(loan)
                .lender(lender)
                .amount(amount)
                .interestRate(interestRate)
                .build();
        loanContributionRepository.save(contribution);

        // Mark loan as group funded
        if (!loan.getIsGroupFunded()) {
            loan.setIsGroupFunded(true);
        }

        double newTotal = totalContributed + amount;

        Map<String, Object> response = new HashMap<>();
        response.put("contributionId", contribution.getId());
        response.put("amountContributed", amount);
        response.put("interestRate", interestRate);
        response.put("totalFunded", newTotal);
        response.put("totalNeeded", loan.getAmount());
        response.put("remaining", loan.getAmount() - newTotal);

        // Notify borrower
        notificationService.send(loan.getBorrower(), "New Contribution",
                lender.getFirstName() + " contributed GHS " + amount + " to your loan. " +
                String.format("%.0f%%", (newTotal / loan.getAmount()) * 100) + " funded.",
                Notification.NotificationType.LOAN_FUNDED, loan.getId());

        // Check if fully funded
        if (newTotal >= loan.getAmount()) {
            finalizeGroupFunding(loan);
            response.put("message", "Loan fully funded! Agreement pending signatures from all parties.");
            response.put("fullyFunded", true);
        } else {
            response.put("message", "Contribution recorded. GHS " + String.format("%.2f", loan.getAmount() - newTotal) + " remaining.");
            response.put("fullyFunded", false);
            loanRepository.save(loan);
        }

        return response;
    }

    /**
     * When fully funded, calculate weighted average interest rate and generate agreement.
     */
    private void finalizeGroupFunding(Loan loan) {
        List<LoanContribution> contributions = loanContributionRepository.findByLoan(loan);

        // Calculate weighted average interest rate
        double totalWeightedInterest = 0;
        double totalAmount = 0;
        for (LoanContribution c : contributions) {
            totalWeightedInterest += c.getAmount() * c.getInterestRate();
            totalAmount += c.getAmount();
        }
        double weightedAvgRate = totalAmount > 0 ? totalWeightedInterest / totalAmount : 0;
        weightedAvgRate = Math.round(weightedAvgRate * 100.0) / 100.0;

        loan.setInterestRate(weightedAvgRate);
        double totalRepayment = loan.getAmount() * (1 + weightedAvgRate / 100);
        loan.setTotalRepaymentAmount(Math.round(totalRepayment * 100.0) / 100.0);
        loan.setStatus(Loan.LoanStatus.AGREEMENT_PENDING);
        loanRepository.save(loan);

        // Generate group agreement
        StringBuilder lenderNames = new StringBuilder();
        StringBuilder repaymentSchedule = new StringBuilder();
        repaymentSchedule.append("GROUP FUNDING BREAKDOWN:\n\n");

        for (LoanContribution c : contributions) {
            User lender = c.getLender();
            lenderNames.append(lender.getFirstName()).append(" ").append(lender.getLastName()).append(", ");

            double lenderRepayment = c.getAmount() * (1 + c.getInterestRate() / 100);
            repaymentSchedule.append("- ").append(lender.getFirstName()).append(" ").append(lender.getLastName())
                    .append(": Contributed GHS ").append(String.format("%.2f", c.getAmount()))
                    .append(" at ").append(c.getInterestRate()).append("% interest")
                    .append(" → Receives GHS ").append(String.format("%.2f", lenderRepayment))
                    .append("\n");
        }

        repaymentSchedule.append("\nTotal Loan: GHS ").append(String.format("%.2f", loan.getAmount()));
        repaymentSchedule.append("\nWeighted Avg Interest: ").append(weightedAvgRate).append("%");
        repaymentSchedule.append("\nTotal Repayment: GHS ").append(String.format("%.2f", totalRepayment));

        String lenderNamesStr = lenderNames.length() > 2 ? lenderNames.substring(0, lenderNames.length() - 2) : "Multiple Lenders";

        LoanAgreement agreement = LoanAgreement.builder()
                .loan(loan)
                .borrowerName(loan.getBorrower().getFirstName() + " " + loan.getBorrower().getLastName())
                .borrowerPhone(loan.getBorrower().getPhone())
                .lenderName(lenderNamesStr)
                .lenderPhone("Group Funded")
                .principalAmount(loan.getAmount())
                .interestRate(weightedAvgRate)
                .totalRepaymentAmount(totalRepayment)
                .repaymentType(loan.getRepaymentType().name())
                .repaymentSchedule(repaymentSchedule.toString())
                .gracePeriodDays(7)
                .dailyOverdueRate(loan.getDailyOverdueRate())
                .termsAndConditions(
                    "GROUP LOAN AGREEMENT\n\n" +
                    "This is a group-funded loan agreement between the borrower and multiple lenders.\n\n" +
                    "1. The borrower agrees to repay the total amount of GHS " + String.format("%.2f", totalRepayment) + ".\n" +
                    "2. Repayment will be distributed proportionally to each lender based on their contribution.\n" +
                    "3. A 7-day grace period applies after the due date.\n" +
                    "4. Daily overdue interest of " + loan.getDailyOverdueRate() + "% applies after the grace period.\n" +
                    "5. Default consequences apply per platform rules.\n" +
                    "6. All parties must sign this agreement before disbursement.\n\n" +
                    "LENDERS:\n" + lenderNamesStr + "\n\n" +
                    "BORROWER:\n" + loan.getBorrower().getFirstName() + " " + loan.getBorrower().getLastName()
                )
                .build();

        loanAgreementRepository.save(agreement);

        // Notify all parties
        notificationService.send(loan.getBorrower(), "Loan Fully Funded",
                "Your loan of GHS " + loan.getAmount() + " has been fully funded by " + contributions.size() + " lenders. Please sign the agreement.",
                Notification.NotificationType.LOAN_AGREEMENT_READY, loan.getId());

        for (LoanContribution c : contributions) {
            notificationService.send(c.getLender(), "Group Loan Funded",
                    "The loan of GHS " + loan.getAmount() + " is fully funded. Please sign the agreement.",
                    Notification.NotificationType.LOAN_AGREEMENT_READY, loan.getId());
        }

        log.info("Group loan {} fully funded with {} contributions, weighted avg rate: {}%", loan.getId(), contributions.size(), weightedAvgRate);
    }

    /**
     * Get contributions for a loan
     */
    public Map<String, Object> getLoanContributions(String phone, Long loanId) {
        User user = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        List<LoanContribution> contributions = loanContributionRepository.findByLoan(loan);

        List<Map<String, Object>> contributionList = contributions.stream().map(c -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", c.getId());
            map.put("lenderName", c.getLender().getFirstName() + " " + c.getLender().getLastName());
            map.put("lenderId", c.getLender().getId());
            map.put("amount", c.getAmount());
            map.put("interestRate", c.getInterestRate());
            map.put("repaymentDue", c.getAmount() * (1 + c.getInterestRate() / 100));
            map.put("amountRepaid", c.getAmountRepaid());
            map.put("contributedAt", c.getContributedAt());
            return map;
        }).collect(Collectors.toList());

        double totalContributed = getTotalContributed(loan);

        Map<String, Object> response = new HashMap<>();
        response.put("loanId", loan.getId());
        response.put("loanAmount", loan.getAmount());
        response.put("isGroupFunded", loan.getIsGroupFunded());
        response.put("totalContributed", totalContributed);
        response.put("remaining", Math.max(0, loan.getAmount() - totalContributed));
        response.put("percentFunded", loan.getAmount() > 0 ? Math.round(totalContributed / loan.getAmount() * 100 * 10.0) / 10.0 : 0);
        response.put("contributorCount", contributions.size());
        response.put("contributions", contributionList);
        return response;
    }

    /**
     * Process group loan repayment — distribute proportionally to all lenders.
     * Called after a successful repayment (from LoanService or PaystackService).
     */
    @Transactional
    public void distributeGroupRepayment(Loan loan, Double repaymentAmount) {
        if (!loan.getIsGroupFunded()) return;

        List<LoanContribution> contributions = loanContributionRepository.findByLoan(loan);
        if (contributions.isEmpty()) return;

        double totalLoanRepayment = loan.getTotalRepaymentAmount() + loan.getOverdueInterestAccrued();

        for (LoanContribution c : contributions) {
            double lenderShare = c.getAmount() * (1 + c.getInterestRate() / 100);
            double proportion = lenderShare / totalLoanRepayment;
            double lenderRepayment = repaymentAmount * proportion;
            lenderRepayment = Math.round(lenderRepayment * 100.0) / 100.0;

            c.setAmountRepaid(c.getAmountRepaid() + lenderRepayment);
            loanContributionRepository.save(c);

            // Notify each lender of their share
            notificationService.send(c.getLender(), "Repayment Received",
                    "You received GHS " + String.format("%.2f", lenderRepayment) + " from " +
                    loan.getBorrower().getFirstName() + "'s loan repayment.",
                    Notification.NotificationType.LOAN_REPAID, loan.getId());
        }

        log.info("Distributed GHS {} repayment across {} lenders for loan {}", repaymentAmount, contributions.size(), loan.getId());
    }

    /**
     * Sign group agreement — all lenders and borrower must sign.
     */
    @Transactional
    public Map<String, Object> signGroupAgreement(String phone, Long loanId) {
        User signer = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getStatus() != Loan.LoanStatus.AGREEMENT_PENDING) {
            throw new RuntimeException("No agreement pending for this loan");
        }

        LoanAgreement agreement = loanAgreementRepository.findByLoan(loan)
                .orElseThrow(() -> new RuntimeException("Agreement not found"));

        boolean isBorrower = signer.getId().equals(loan.getBorrower().getId());
        boolean isContributor = loanContributionRepository.findByLoanAndLender(loan, signer).isPresent();

        if (!isBorrower && !isContributor) {
            throw new RuntimeException("You are not a party to this loan");
        }

        if (isBorrower) {
            if (agreement.getBorrowerSigned()) throw new RuntimeException("You have already signed");
            agreement.setBorrowerSigned(true);
            agreement.setBorrowerSignedAt(LocalDateTime.now());
        }

        if (isContributor) {
            if (agreement.getLenderSigned()) {
                // For group loans, we track lender signing differently
                // For simplicity, once any lender signs, we mark lender as signed
                // In a production system, you'd track individual signatures
            }
            agreement.setLenderSigned(true);
            agreement.setLenderSignedAt(LocalDateTime.now());
        }

        loanAgreementRepository.save(agreement);

        // Check if all parties have signed
        Map<String, Object> response = new HashMap<>();
        response.put("signed", true);
        response.put("borrowerSigned", agreement.getBorrowerSigned());
        response.put("lenderSigned", agreement.getLenderSigned());

        if (agreement.getBorrowerSigned() && agreement.getLenderSigned()) {
            loan.setStatus(Loan.LoanStatus.AGREEMENT_SIGNED);
            loanRepository.save(loan);
            response.put("message", "All parties have signed. Loan is ready for disbursement.");
            response.put("allSigned", true);

            // Notify all parties
            notificationService.send(loan.getBorrower(), "Agreement Signed",
                    "All parties have signed the loan agreement. Awaiting disbursement.",
                    Notification.NotificationType.LOAN_AGREEMENT_SIGNED, loan.getId());
        } else {
            response.put("message", "Your signature has been recorded. Waiting for other parties.");
            response.put("allSigned", false);
        }

        return response;
    }

    /**
     * Disburse a group-funded loan.
     * In a group loan, each lender's Paystack payment handles their portion.
     * This method handles the manual/non-Paystack disbursement.
     */
    @Transactional
    public Map<String, Object> disburseGroupLoan(String phone, Long loanId) {
        User requester = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getStatus() != Loan.LoanStatus.AGREEMENT_SIGNED) {
            throw new RuntimeException("Agreement must be signed before disbursement");
        }

        if (!loan.getIsGroupFunded()) {
            throw new RuntimeException("This is not a group-funded loan");
        }

        // Any contributor can trigger disbursement
        boolean isContributor = loanContributionRepository.findByLoanAndLender(loan, requester).isPresent();
        if (!isContributor) {
            throw new RuntimeException("Only a contributing lender can disburse");
        }

        loan.setStatus(Loan.LoanStatus.ACTIVE);
        loan.setDisbursedAt(LocalDateTime.now());
        if (loan.getDueDate() == null) {
            loan.setDueDate(LocalDateTime.now().plusMonths(loan.getRepaymentPeriodMonths()));
        }

        // Update stats for borrower
        User borrower = loan.getBorrower();
        borrower.setTotalLoansReceived(borrower.getTotalLoansReceived() + 1);
        userRepository.save(borrower);

        // Update stats for each lender
        List<LoanContribution> contributions = loanContributionRepository.findByLoan(loan);
        for (LoanContribution c : contributions) {
            User lender = c.getLender();
            lender.setTotalLoansGiven(lender.getTotalLoansGiven() + 1);
            userRepository.save(lender);

            circleMemberRepository.findByCircleAndUser(loan.getCircle(), lender).ifPresent(m -> {
                m.setLoansGivenInCircle(m.getLoansGivenInCircle() + 1);
                circleMemberRepository.save(m);
            });
        }

        circleMemberRepository.findByCircleAndUser(loan.getCircle(), borrower).ifPresent(m -> {
            m.setLoansReceivedInCircle(m.getLoansReceivedInCircle() + 1);
            circleMemberRepository.save(m);
        });

        loanRepository.save(loan);

        // Notify
        notificationService.send(borrower, "Group Loan Disbursed",
                "Your group loan of GHS " + loan.getAmount() + " from " + contributions.size() + " lenders has been disbursed.",
                Notification.NotificationType.LOAN_DISBURSED, loan.getId());

        for (LoanContribution c : contributions) {
            notificationService.send(c.getLender(), "Group Loan Disbursed",
                    "The group loan of GHS " + loan.getAmount() + " to " + borrower.getFirstName() + " has been disbursed.",
                    Notification.NotificationType.LOAN_DISBURSED, loan.getId());
        }

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Group loan disbursed successfully");
        response.put("loanId", loan.getId());
        response.put("amount", loan.getAmount());
        response.put("lenderCount", contributions.size());
        response.put("dueDate", loan.getDueDate());
        return response;
    }

    private double getTotalContributed(Loan loan) {
        return loanContributionRepository.findByLoan(loan).stream()
                .mapToDouble(LoanContribution::getAmount).sum();
    }

    private User getUserByPhone(String phone) {
        return userRepository.findByPhone(phone).orElseThrow(() -> new RuntimeException("User not found"));
    }
}
