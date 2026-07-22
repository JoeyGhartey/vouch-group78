package com.vouch.loan.service;

import com.vouch.loan.dto.*;
import com.vouch.loan.entity.*;
import com.vouch.loan.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LoanService {

    private final LoanRepository loanRepository;
    private final LoanAgreementRepository loanAgreementRepository;
    private final CircleRepository circleRepository;
    private final CircleMemberRepository circleMemberRepository;
    private final CircleService circleService;
    private final TrustScoreService trustScoreService;
    private final InstallmentService installmentService;
    private final AuthServiceClient authServiceClient;
    private final NotificationServiceClient notificationServiceClient;
    private final ExpenseServiceClient expenseServiceClient;
    private final GroupFundingService groupFundingService;
    private static final double PLATFORM_FEE_PERCENT = 2.0;
    private static final EnumSet<Loan.LoanStatus> FUNDED_STATUSES = EnumSet.of(
            Loan.LoanStatus.DISBURSED, Loan.LoanStatus.ACTIVE, Loan.LoanStatus.DUE,
            Loan.LoanStatus.GRACE_PERIOD, Loan.LoanStatus.REPAID, Loan.LoanStatus.DEFAULTED,
            Loan.LoanStatus.DISPUTED);
    private static final EnumSet<Loan.LoanStatus> ACTIVE_STATUSES = EnumSet.of(
            Loan.LoanStatus.ACTIVE, Loan.LoanStatus.DUE, Loan.LoanStatus.GRACE_PERIOD);

    // The auth-service User.totalLoansGiven / totalLoansReceived fields (shown
    // on the Home screen's stat pills) were never being written anywhere —
    // they sat at their registration-time default of 0 forever. This recomputes
    // both counts from actual funded loans and pushes them, called right after
    // a loan is disbursed (the point a loan "counts" as real, not just requested).
    private void syncLoanCountStats(Long borrowerId, Long lenderId) {
        try {
            int totalLoansReceived = (int) loanRepository.findByBorrowerIdOrderByCreatedAtDesc(borrowerId).stream()
                    .filter(l -> FUNDED_STATUSES.contains(l.getStatus())).count();
            authServiceClient.updateUserStats(borrowerId, null, null, null, null, totalLoansReceived);

            if (lenderId != null) {
                int totalLoansGiven = (int) loanRepository.findByLenderIdOrderByCreatedAtDesc(lenderId).stream()
                        .filter(l -> FUNDED_STATUSES.contains(l.getStatus())).count();
                authServiceClient.updateUserStats(lenderId, null, null, null, totalLoansGiven, null);
            }
        } catch (Exception e) {
            // Non-critical display stat — never let this block a real disbursement.
        }
    }

    // One-time catch-up for loans that were disbursed BEFORE syncLoanCountStats
    // existed — those never had their totalLoansGiven/totalLoansReceived written,
    // and syncLoanCountStats only fires on new disbursements going forward, so it
    // can't retroactively fix them. Recomputes every user's real count from full
    // loan history and pushes it. Safe to run more than once — it's idempotent.
    public Map<String, Object> backfillLoanCountStats() {
        List<Loan> funded = loanRepository.findAll().stream()
                .filter(l -> FUNDED_STATUSES.contains(l.getStatus()))
                .collect(Collectors.toList());

        Map<Long, Long> borrowedCounts = funded.stream()
                .collect(Collectors.groupingBy(Loan::getBorrowerId, Collectors.counting()));
        Map<Long, Long> lentCounts = funded.stream()
                .filter(l -> l.getLenderId() != null)
                .collect(Collectors.groupingBy(Loan::getLenderId, Collectors.counting()));

        int borrowersUpdated = 0;
        for (Map.Entry<Long, Long> entry : borrowedCounts.entrySet()) {
            authServiceClient.updateUserStats(entry.getKey(), null, null, null, null, entry.getValue().intValue());
            borrowersUpdated++;
        }
        int lendersUpdated = 0;
        for (Map.Entry<Long, Long> entry : lentCounts.entrySet()) {
            authServiceClient.updateUserStats(entry.getKey(), null, null, null, entry.getValue().intValue(), null);
            lendersUpdated++;
        }

        Map<String, Object> result = new java.util.HashMap<>();
        result.put("borrowersUpdated", borrowersUpdated);
        result.put("lendersUpdated", lendersUpdated);
        return result;
    }

    @Transactional
    public LoanResponse requestLoan(String phone, LoanRequest request) {
        Map<String, Object> borrowerInfo = authServiceClient.getUserInfoByPhone(phone);
        Long borrowerId = ((Number) borrowerInfo.get("id")).longValue();
        Circle circle = circleRepository.findById(request.getCircleId())
                .orElseThrow(() -> new RuntimeException("Circle not found"));

        circleService.validateMembership(circle, borrowerId);

        if (Boolean.TRUE.equals(borrowerInfo.get("permanentBan"))) {
            throw new RuntimeException("You are permanently banned from borrowing");
        }
        if (Boolean.TRUE.equals(borrowerInfo.get("borrowingSuspended"))) {
            Object suspendedUntilRaw = borrowerInfo.get("borrowingSuspendedUntil");
            boolean stillSuspended = true;
            if (suspendedUntilRaw != null) {
                try {
                    stillSuspended = java.time.LocalDateTime.parse(suspendedUntilRaw.toString())
                            .isAfter(java.time.LocalDateTime.now());
                } catch (Exception ignored) {
                    // Unparseable date -- fail safe and keep the suspension in effect.
                }
            }
            if (stillSuspended) {
                throw new RuntimeException("Your borrowing is currently suspended" +
                        (suspendedUntilRaw != null ? " until " + suspendedUntilRaw : ""));
            }
        }
        Object trustScoreRaw = borrowerInfo.get("trustScore");
        double trustScore = trustScoreRaw instanceof Number ? ((Number) trustScoreRaw).doubleValue() : 50.0;
        if (trustScore < 20) {
            throw new RuntimeException("Your trust score is too low to borrow. Repay outstanding loans to recover.");
        }

        if (request.getAmount() <= 0) {
            throw new RuntimeException("Loan amount must be greater than zero");
        }
        if (request.getAmount() > circle.getMaxLoanAmount()) {
            throw new RuntimeException("Amount exceeds circle's maximum loan amount of " + circle.getMaxLoanAmount());
        }

        List<Loan> existingActiveLoans = loanRepository.findByBorrowerIdAndStatus(borrowerId, Loan.LoanStatus.ACTIVE);
        long activeInCircle = existingActiveLoans.stream()
                .filter(l -> l.getCircle().getId().equals(circle.getId()))
                .count();
        if (activeInCircle >= 3) {
            throw new RuntimeException("You already have 3 active loans in this circle. Repay existing loans first.");
        }

        Loan.RepaymentType repaymentType = Loan.RepaymentType.FIXED;
        if (request.getRepaymentType() != null && request.getRepaymentType().equalsIgnoreCase("FLEXIBLE")) {
            repaymentType = Loan.RepaymentType.FLEXIBLE;
        }

        int repaymentPeriod = request.getRepaymentPeriodMonths() != null ? request.getRepaymentPeriodMonths() : 1;
        if (repaymentPeriod < 1 || repaymentPeriod > 12) {
            throw new RuntimeException("Repayment period must be between 1 and 12 months");
        }

        LocalDateTime dueDate = null;
        if (request.getDueDate() != null && !request.getDueDate().isBlank()) {
            try {
                dueDate = LocalDateTime.parse(request.getDueDate(), DateTimeFormatter.ISO_DATE_TIME);
            } catch (java.time.format.DateTimeParseException e) {
                throw new RuntimeException("Invalid due date format. Expected an ISO date-time, e.g. 2026-08-01T00:00:00");
            }
            if (dueDate.isBefore(LocalDateTime.now())) {
                throw new RuntimeException("Due date cannot be in the past");
            }
        }

        Loan loan = Loan.builder()
                .borrowerId(borrowerId)
                .circle(circle)
                .amount(request.getAmount())
                .reason(request.getReason())
                .repaymentType(repaymentType)
                .repaymentPeriodMonths(repaymentPeriod)
                .dueDate(dueDate)
                .status(Loan.LoanStatus.REQUESTED)
                .isGroupFunded(request.getAmount() >= effectiveGroupFundingThreshold(circle.getGroupFundingThreshold(), trustScore))
                .build();

        loan = loanRepository.save(loan);

        List<CircleMember> circleMembers = circleMemberRepository.findByCircleAndStatus(circle, CircleMember.MemberStatus.ACTIVE);
        String borrowerName = authServiceClient.getUserName(borrowerId);
        for (CircleMember member : circleMembers) {
            if (!member.getUserId().equals(borrowerId)) {
                notificationServiceClient.send(member.getUserId(), "New Loan Request",
                        borrowerName + " requested a loan of GHS " + request.getAmount() + " in \"" + circle.getName() + "\"",
                        "LOAN_REQUESTED", loan.getId());
            }
        }

        return mapToLoanResponse(loan, "Loan request posted to circle");
    }

    @Transactional
    public LoanResponse fundLoan(String phone, FundLoanRequest request) {
        Long lenderId = authServiceClient.getUserIdByPhone(phone);
        Loan loan = loanRepository.findByIdForUpdate(request.getLoanId())
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getStatus() != Loan.LoanStatus.REQUESTED) {
            throw new RuntimeException("This loan is not available for funding");
        }

        if (Boolean.TRUE.equals(loan.getIsGroupFunded()) && !Boolean.TRUE.equals(request.getOverrideGroupFunding())) {
            throw new RuntimeException("This loan is above the circle's group funding threshold for this borrower's trust tier (GHS "
                    + String.format("%.2f", loan.getCircle().getGroupFundingThreshold())
                    + " base) and is recommended to be funded by multiple members. "
                    + "If you're willing to fund it alone, resubmit with overrideGroupFunding.");
        }

        circleService.validateMembership(loan.getCircle(), lenderId);

        if (lenderId.equals(loan.getBorrowerId())) {
            throw new RuntimeException("You cannot fund your own loan");
        }

        if (request.getInterestRate() < 0) {
            throw new RuntimeException("Interest rate cannot be negative");
        }
        if (request.getInterestRate() > 50) {
            throw new RuntimeException("Interest rate cannot exceed 50% to prevent predatory lending");
        }

        Double borrowerTrustScore = authServiceClient.getUserTrustScore(loan.getBorrowerId());
        InterestRateTier tier = computeInterestRateTier(borrowerTrustScore);

        if (request.getInterestRate() > tier.maxRate()) {
            throw new RuntimeException("Interest rate of " + request.getInterestRate() + "% exceeds the maximum allowed for this borrower's trust tier. "
                    + "Borrower trust score: " + String.format("%.0f", borrowerTrustScore) + " (" + tier.label() + "), max allowed rate: " + tier.maxRate() + "%");
        }

        loan.setLenderId(lenderId);
        loan.setInterestRate(request.getInterestRate());

        double totalRepayment = loan.getAmount() * (1 + request.getInterestRate() / 100);
        loan.setTotalRepaymentAmount(Math.round(totalRepayment * 100.0) / 100.0);

        loan.setStatus(Loan.LoanStatus.AGREEMENT_PENDING);
        loan = loanRepository.save(loan);

        generateAgreement(loan);

        return mapToLoanResponse(loan, "Loan funded. Agreement pending signatures.");
    }

    @Transactional
    public LoanResponse signAgreement(String phone, Long loanId) {
        Long signerId = authServiceClient.getUserIdByPhone(phone);
        Loan loan = loanRepository.findByIdForUpdate(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getStatus() != Loan.LoanStatus.AGREEMENT_PENDING) {
            throw new RuntimeException("This loan is not in agreement signing stage");
        }

        LoanAgreement agreement = loanAgreementRepository.findByLoan(loan)
                .orElseThrow(() -> new RuntimeException("Agreement not found"));

        if (signerId.equals(loan.getBorrowerId())) {
            if (agreement.getBorrowerSigned()) {
                throw new RuntimeException("You have already signed this agreement");
            }
            agreement.setBorrowerSigned(true);
            agreement.setBorrowerSignedAt(LocalDateTime.now());
        } else if (loan.getLenderId() != null && signerId.equals(loan.getLenderId())) {
            if (agreement.getLenderSigned()) {
                throw new RuntimeException("You have already signed this agreement");
            }
            agreement.setLenderSigned(true);
            agreement.setLenderSignedAt(LocalDateTime.now());
        } else {
            throw new RuntimeException("You are not a party to this loan");
        }

        loanAgreementRepository.save(agreement);

        if (agreement.getBorrowerSigned() && agreement.getLenderSigned()) {
            loan.setStatus(Loan.LoanStatus.AGREEMENT_SIGNED);
            loan = loanRepository.save(loan);
            return mapToLoanResponse(loan, "Both parties signed. Ready for disbursement.");
        }

        return mapToLoanResponse(loan, "Agreement signed. Waiting for other party.");
    }

    @Transactional
    public LoanResponse disburseLoan(String phone, Long loanId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Loan loan = loanRepository.findByIdForUpdate(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getStatus() != Loan.LoanStatus.AGREEMENT_SIGNED) {
            throw new RuntimeException("Agreement must be signed by both parties before disbursement");
        }

        if (loan.getLenderId() == null || !userId.equals(loan.getLenderId())) {
            throw new RuntimeException("Only the lender can trigger disbursement");
        }

        double platformFee = Math.round(loan.getAmount() * PLATFORM_FEE_PERCENT / 100 * 100.0) / 100.0;
        double amountAfterFee = loan.getAmount() - platformFee;
        loan.setPlatformFee(platformFee);
        loan.setBorrowerReceivedAmount(amountAfterFee);
        loan.setStatus(Loan.LoanStatus.DISBURSED);
        loan.setDisbursedAt(LocalDateTime.now());

        if (loan.getDueDate() == null) {
            if (loan.getRepaymentType() == Loan.RepaymentType.FIXED) {
                loan.setDueDate(LocalDateTime.now().plusMonths(loan.getRepaymentPeriodMonths()));
            } else {
                loan.setDueDate(LocalDateTime.now().plusMonths(1));
            }
        }

        loan.setStatus(Loan.LoanStatus.ACTIVE);

        CircleMember borrowerMember = circleMemberRepository.findByCircleAndUserId(loan.getCircle(), loan.getBorrowerId()).orElse(null);
        if (borrowerMember != null) {
            borrowerMember.setLoansReceivedInCircle(borrowerMember.getLoansReceivedInCircle() + 1);
            circleMemberRepository.save(borrowerMember);
        }

        CircleMember lenderMember = circleMemberRepository.findByCircleAndUserId(loan.getCircle(), loan.getLenderId()).orElse(null);
        if (lenderMember != null) {
            lenderMember.setLoansGivenInCircle(lenderMember.getLoansGivenInCircle() + 1);
            circleMemberRepository.save(lenderMember);
        }

        loan = loanRepository.save(loan);
        installmentService.generateInstallments(loan);
        syncLoanCountStats(loan.getBorrowerId(), loan.getLenderId());

        expenseServiceClient.logTransaction(
                loan.getBorrowerId(),
                "Loan received - " + loan.getCircle().getName(),
                amountAfterFee,
                "Loan",
                "INCOME"
        );

        return mapToLoanResponse(loan, "Loan disbursed and active. Platform fee: GHS " + String.format("%.2f", platformFee) + ". Borrower receives: GHS " + String.format("%.2f", amountAfterFee));
    }

    @Transactional
    public LoanResponse repayLoan(String phone, Long loanId, Double amount) {
        Long borrowerId = authServiceClient.getUserIdByPhone(phone);
        Loan loan = loanRepository.findByIdForUpdate(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (!borrowerId.equals(loan.getBorrowerId())) {
            throw new RuntimeException("Only the borrower can repay this loan");
        }

        if (loan.getStatus() != Loan.LoanStatus.ACTIVE &&
            loan.getStatus() != Loan.LoanStatus.DUE &&
            loan.getStatus() != Loan.LoanStatus.GRACE_PERIOD) {
            throw new RuntimeException("This loan is not in a repayable state");
        }

        double totalOwed = loan.getTotalRepaymentAmount() + loan.getOverdueInterestAccrued() - loan.getAmountRepaid();
        double repayAmount = amount != null ? amount : totalOwed;

        if (repayAmount <= 0) {
            throw new RuntimeException("Repayment amount must be greater than zero");
        }
        if (repayAmount > totalOwed) {
            throw new RuntimeException("Repayment amount exceeds total owed. You owe " + String.format("%.2f", totalOwed));
        }

        loan.setAmountRepaid(Math.round((loan.getAmountRepaid() + repayAmount) * 100.0) / 100.0);

        expenseServiceClient.logTransaction(
                loan.getBorrowerId(),
                "Loan repayment - " + loan.getCircle().getName(),
                repayAmount,
                "Loan",
                "EXPENSE"
        );
        if (loan.getLenderId() != null) {
            expenseServiceClient.logTransaction(
                    loan.getLenderId(),
                    "Repayment received - " + loan.getCircle().getName(),
                    repayAmount,
                    "Loan",
                    "INCOME"
            );
        } else if (loan.getIsGroupFunded()) {
            // No single lenderId for a group-funded loan -- split the repayment
            // across each contributing lender proportionally to what they put in.
            groupFundingService.distributeGroupRepayment(loan, repayAmount);
        }

        if (loan.getAmountRepaid() >= loan.getTotalRepaymentAmount() + loan.getOverdueInterestAccrued()) {
            loan.setStatus(Loan.LoanStatus.REPAID);
            loan.setCompletedAt(LocalDateTime.now());

            boolean onTime = loan.getGracePeriodStart() == null;
            trustScoreService.updateScoreOnRepayment(loan.getBorrowerId(), loan, onTime);

            CircleMember borrowerMember = circleMemberRepository.findByCircleAndUserId(loan.getCircle(), loan.getBorrowerId()).orElse(null);
            if (borrowerMember != null) {
                borrowerMember.setLoansRepaidInCircle(borrowerMember.getLoansRepaidInCircle() + 1);
                circleMemberRepository.save(borrowerMember);
            }

            loan = loanRepository.save(loan);
            return mapToLoanResponse(loan, "Loan fully repaid.");
        }

        loan = loanRepository.save(loan);
        double remaining = totalOwed - repayAmount;
        return mapToLoanResponse(loan, "Partial repayment recorded. Remaining: " + String.format("%.2f", remaining));
    }

    @Transactional
    public LoanResponse defaultLoan(String phone, Long loanId) {
        Long lenderId = authServiceClient.getUserIdByPhone(phone);
        Loan loan = loanRepository.findByIdForUpdate(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        boolean isSingleLender = loan.getLenderId() != null && lenderId.equals(loan.getLenderId());
        boolean isGroupContributor = Boolean.TRUE.equals(loan.getIsGroupFunded()) && groupFundingService.isContributor(loan, lenderId);
        if (!isSingleLender && !isGroupContributor) {
            throw new RuntimeException("Only a lender on this loan can mark it as defaulted");
        }

        if (loan.getStatus() != Loan.LoanStatus.GRACE_PERIOD) {
            throw new RuntimeException("Loan can only be defaulted after entering the grace period");
        }

        if (loan.getGracePeriodEnd() != null && loan.getGracePeriodEnd().isAfter(LocalDateTime.now())) {
            throw new RuntimeException("Grace period has not expired yet. Expires at " + loan.getGracePeriodEnd());
        }

        loan.setStatus(Loan.LoanStatus.DEFAULTED);
        loan.setDefaultedAt(LocalDateTime.now());

        trustScoreService.updateScoreOnDefault(loan.getBorrowerId(), loan);

        CircleMember borrowerMember = circleMemberRepository.findByCircleAndUserId(loan.getCircle(), loan.getBorrowerId()).orElse(null);
        if (borrowerMember != null) {
            borrowerMember.setDefaultsInCircle(borrowerMember.getDefaultsInCircle() + 1);
            circleMemberRepository.save(borrowerMember);
        }

        List<CircleMember> circleMembers = circleMemberRepository.findByCircleAndStatus(loan.getCircle(), CircleMember.MemberStatus.ACTIVE);
        String borrowerName = authServiceClient.getUserName(loan.getBorrowerId());
        for (CircleMember member : circleMembers) {
            if (!member.getUserId().equals(loan.getBorrowerId())) {
                notificationServiceClient.send(member.getUserId(), "Loan Default",
                        borrowerName + " has defaulted on a loan in " + loan.getCircle().getName(),
                        "LOAN_DEFAULTED", loan.getId());
            }
        }

        loan = loanRepository.save(loan);
        return mapToLoanResponse(loan, "Loan marked as defaulted. Borrower's trust score has been impacted.");
    }

    @Transactional
    public LoanResponse cancelLoan(String phone, Long loanId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Loan loan = loanRepository.findByIdForUpdate(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (!userId.equals(loan.getBorrowerId())) {
            throw new RuntimeException("Only the borrower can cancel a loan request");
        }

        if (loan.getStatus() != Loan.LoanStatus.REQUESTED
                && loan.getStatus() != Loan.LoanStatus.AGREEMENT_PENDING) {
            throw new RuntimeException("Only loans that haven't been disbursed yet can be cancelled");
        }

        loanAgreementRepository.findByLoan(loan).ifPresent(loanAgreementRepository::delete);

        loan.setStatus(Loan.LoanStatus.CANCELLED);
        loan = loanRepository.save(loan);

        if (loan.getLenderId() != null) {
            String borrowerName = authServiceClient.getUserName(userId);
            notificationServiceClient.send(loan.getLenderId(), "Loan Cancelled",
                    borrowerName + " cancelled a GHS " + loan.getAmount() + " loan you were funding.",
                    "LOAN_CANCELLED", loan.getId());
        }

        return mapToLoanResponse(loan, "Loan request cancelled.");
    }

    @Transactional
    public LoanResponse rejectAgreement(Long loanId, String borrowerPhone) {
        Long borrowerId = authServiceClient.getUserIdByPhone(borrowerPhone);
        Loan loan = loanRepository.findByIdForUpdate(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (!borrowerId.equals(loan.getBorrowerId())) {
            throw new RuntimeException("Only the borrower can reject this agreement");
        }
        if (loan.getStatus() != Loan.LoanStatus.AGREEMENT_PENDING) {
            throw new RuntimeException("This loan is not awaiting agreement (current status: " + loan.getStatus() + ")");
        }

        Long rejectedLenderId = loan.getLenderId();
        String borrowerName = authServiceClient.getUserName(borrowerId);

        loanAgreementRepository.findByLoan(loan).ifPresent(loanAgreementRepository::delete);

        loan.setLenderId(null);
        loan.setInterestRate(0.0);
        loan.setTotalRepaymentAmount(0.0);
        loan.setCounterOfferRate(null);
        loan.setStatus(Loan.LoanStatus.REQUESTED);
        loan = loanRepository.save(loan);

        if (rejectedLenderId != null) {
            notificationServiceClient.send(rejectedLenderId, "Agreement Rejected",
                    borrowerName + " rejected your funding offer for a GHS " + loan.getAmount() + " loan. The request is open again.",
                    "LOAN_AGREEMENT_READY", loan.getId());
        }

        return mapToLoanResponse(loan, "Agreement rejected. Loan request is open for funding again.");
    }

    @Transactional
    public LoanResponse proposeCounterOffer(Long loanId, String borrowerPhone, Double newRate) {
        Long borrowerId = authServiceClient.getUserIdByPhone(borrowerPhone);
        Loan loan = loanRepository.findByIdForUpdate(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (!borrowerId.equals(loan.getBorrowerId())) {
            throw new RuntimeException("Only the borrower can propose a counter-offer");
        }
        if (loan.getStatus() != Loan.LoanStatus.AGREEMENT_PENDING) {
            throw new RuntimeException("This loan is not awaiting agreement (current status: " + loan.getStatus() + ")");
        }
        if (newRate == null || newRate < 0) {
            throw new RuntimeException("Counter-offer rate cannot be negative");
        }
        if (newRate > 50) {
            throw new RuntimeException("Counter-offer rate cannot exceed 50% to prevent predatory lending");
        }
        if (newRate.equals(loan.getInterestRate())) {
            throw new RuntimeException("Counter-offer rate must differ from the current rate of " + loan.getInterestRate() + "%");
        }

        LoanAgreement agreement = loanAgreementRepository.findByLoan(loan)
                .orElseThrow(() -> new RuntimeException("Agreement not found"));
        if (agreement.getBorrowerSigned() || agreement.getLenderSigned()) {
            throw new RuntimeException("Cannot counter-offer after either party has signed the agreement");
        }

        loan.setCounterOfferRate(newRate);
        loan = loanRepository.save(loan);

        String borrowerName = authServiceClient.getUserName(borrowerId);
        notificationServiceClient.send(loan.getLenderId(), "Counter-Offer Received",
                borrowerName + " proposed " + newRate + "% interest instead of " + agreement.getInterestRate() +
                        "% for a GHS " + loan.getAmount() + " loan.",
                "LOAN_AGREEMENT_READY", loan.getId());

        return mapToLoanResponse(loan, "Counter-offer of " + newRate + "% sent to lender.");
    }

    @Transactional
    public LoanResponse respondToCounterOffer(Long loanId, String lenderPhone, boolean accept) {
        Long lenderId = authServiceClient.getUserIdByPhone(lenderPhone);
        Loan loan = loanRepository.findByIdForUpdate(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getLenderId() == null || !lenderId.equals(loan.getLenderId())) {
            throw new RuntimeException("Only the lender can respond to this counter-offer");
        }
        if (loan.getStatus() != Loan.LoanStatus.AGREEMENT_PENDING) {
            throw new RuntimeException("This loan is not awaiting agreement (current status: " + loan.getStatus() + ")");
        }
        if (loan.getCounterOfferRate() == null) {
            throw new RuntimeException("There is no pending counter-offer for this loan");
        }

        LoanAgreement agreement = loanAgreementRepository.findByLoan(loan)
                .orElseThrow(() -> new RuntimeException("Agreement not found"));

        double proposedRate = loan.getCounterOfferRate();

        if (accept) {
            double totalRepayment = loan.getAmount() * (1 + proposedRate / 100);
            loan.setInterestRate(proposedRate);
            loan.setTotalRepaymentAmount(Math.round(totalRepayment * 100.0) / 100.0);
            loan.setCounterOfferRate(null);

            agreement.setInterestRate(loan.getInterestRate());
            agreement.setTotalRepaymentAmount(loan.getTotalRepaymentAmount());
            agreement.setBorrowerSigned(false);
            agreement.setBorrowerSignedAt(null);
            agreement.setLenderSigned(false);
            agreement.setLenderSignedAt(null);
            loanAgreementRepository.save(agreement);

            loan = loanRepository.save(loan);

            notificationServiceClient.send(loan.getBorrowerId(), "Counter-Offer Accepted",
                    "Your lender accepted your " + proposedRate + "% counter-offer. Please sign the updated agreement.",
                    "LOAN_AGREEMENT_READY", loan.getId());

            return mapToLoanResponse(loan, "Counter-offer accepted. Both parties must re-sign the updated agreement.");
        } else {
            loan.setCounterOfferRate(null);
            loan = loanRepository.save(loan);

            notificationServiceClient.send(loan.getBorrowerId(), "Counter-Offer Declined",
                    "Your lender declined your " + proposedRate + "% counter-offer. The original rate of " +
                            loan.getInterestRate() + "% still applies. You can sign as-is or reject the agreement.",
                    "LOAN_AGREEMENT_READY", loan.getId());

            return mapToLoanResponse(loan, "Counter-offer declined. Original terms remain.");
        }
    }

    public List<LoanResponse> getCircleLoans(String phone, Long circleId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));
        circleService.validateMembership(circle, userId);
        List<Loan> loans = loanRepository.findByCircleOrderByCreatedAtDesc(circle);
        Map<Long, Map<String, Object>> users = fetchUsersForLoans(loans);
        return loans.stream()
                .map(l -> mapToLoanResponse(l, null, users))
                .collect(Collectors.toList());
    }

    public List<LoanResponse> getCircleLoanRequests(String phone, Long circleId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));
        circleService.validateMembership(circle, userId);
        List<Loan> loans = loanRepository.findByCircleAndStatus(circle, Loan.LoanStatus.REQUESTED);
        Map<Long, Map<String, Object>> users = fetchUsersForLoans(loans);
        return loans.stream()
                .map(l -> mapToLoanResponse(l, null, users))
                .collect(Collectors.toList());
    }

    public List<LoanResponse> getMyLoansAsBorrower(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        List<Loan> loans = loanRepository.findByBorrowerIdOrderByCreatedAtDesc(userId);
        Map<Long, Map<String, Object>> users = fetchUsersForLoans(loans);
        return loans.stream()
                .map(l -> mapToLoanResponse(l, null, users))
                .collect(Collectors.toList());
    }

    public List<LoanResponse> getMyLoansAsLender(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        List<Loan> loans = loanRepository.findByLenderIdOrderByCreatedAtDesc(userId);
        Map<Long, Map<String, Object>> users = fetchUsersForLoans(loans);
        return loans.stream()
                .map(l -> mapToLoanResponse(l, null, users))
                .collect(Collectors.toList());
    }

    public LoanResponse getLoan(String phone, Long loanId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));
        circleService.validateMembership(loan.getCircle(), userId);
        return mapToLoanResponse(loan, null);
    }

    private void generateAgreement(Loan loan) {
        Map<Long, Map<String, Object>> users = authServiceClient.getUsersInfo(
                List.of(loan.getBorrowerId(), loan.getLenderId()));
        Map<String, Object> borrowerInfo = users.get(loan.getBorrowerId());
        Map<String, Object> lenderInfo = users.get(loan.getLenderId());
        String borrowerName = AuthServiceClient.nameOf(borrowerInfo);
        String borrowerPhone = borrowerInfo != null ? (String) borrowerInfo.get("phone") : null;
        String lenderName = AuthServiceClient.nameOf(lenderInfo);
        String lenderPhone = lenderInfo != null ? (String) lenderInfo.get("phone") : null;

        String terms = "This digital loan agreement is entered into by both parties voluntarily. " +
                "The borrower agrees to repay the principal amount plus agreed interest by the specified due date. " +
                "If repayment is not made by the due date, overdue interest of " + loan.getDailyOverdueRate() +
                "% per day will accrue during a 7-day grace period. " +
                "Failure to repay by the end of the grace period may result in the loan being marked as defaulted, " +
                "which will significantly impact the borrower's trust score. " +
                "First default: score drop and circle-wide notification. " +
                "Second default: 30-day borrowing suspension. " +
                "Third default: permanent borrowing ban across all circles. " +
                "This agreement serves as documented evidence of the transaction terms and may be used as " +
                "supporting evidence in any external dispute resolution or legal process. " +
                "Repayment is only recognized when processed through the Vouch platform.";

        LoanAgreement agreement = LoanAgreement.builder()
                .loan(loan)
                .borrowerName(borrowerName)
                .borrowerPhone(borrowerPhone)
                .lenderName(lenderName)
                .lenderPhone(lenderPhone)
                .principalAmount(loan.getAmount())
                .interestRate(loan.getInterestRate())
                .totalRepaymentAmount(loan.getTotalRepaymentAmount())
                .repaymentType(loan.getRepaymentType().name())
                .dailyOverdueRate(loan.getDailyOverdueRate())
                .gracePeriodDays(7)
                .termsAndConditions(terms)
                .build();

        loanAgreementRepository.save(agreement);
    }

    public Map<String, Object> getInternalLoanDetails(Long loanId) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));
        Map<String, Object> details = new java.util.HashMap<>();
        details.put("id", loan.getId());
        details.put("borrowerId", loan.getBorrowerId());
        details.put("lenderId", loan.getLenderId());
        details.put("circleId", loan.getCircle().getId());
        details.put("amount", loan.getAmount());
        details.put("totalRepaymentAmount", loan.getTotalRepaymentAmount());
        details.put("amountRepaid", loan.getAmountRepaid());
        details.put("overdueInterestAccrued", loan.getOverdueInterestAccrued());
        details.put("status", loan.getStatus().name());
        details.put("repaymentPeriodMonths", loan.getRepaymentPeriodMonths());
        details.put("repaymentType", loan.getRepaymentType().name());
        details.put("isGroupFunded", loan.getIsGroupFunded());
        details.put("dueDate", loan.getDueDate());
        return details;
    }

    @Transactional
    public Map<String, Object> setLoanDisputed(Long loanId) {
        Loan loan = loanRepository.findByIdForUpdate(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));
        loan.setPreDisputeStatus(loan.getStatus());
        loan.setStatus(Loan.LoanStatus.DISPUTED);
        loanRepository.save(loan);
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("status", loan.getStatus().name());
        result.put("loanId", loan.getId());
        return result;
    }

    // Called once a dispute-service resolution is recorded, so the loan comes
    // back out of DISPUTED instead of being stuck there permanently (it was
    // previously only ever moved INTO DISPUTED, with no path back out).
    @Transactional
    public Map<String, Object> resolveLoanDispute(Long loanId) {
        Loan loan = loanRepository.findByIdForUpdate(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getStatus() == Loan.LoanStatus.DISPUTED) {
            Loan.LoanStatus restored = loan.getPreDisputeStatus() != null
                    ? loan.getPreDisputeStatus()
                    : Loan.LoanStatus.ACTIVE;
            loan.setStatus(restored);
            loan.setPreDisputeStatus(null);
            loanRepository.save(loan);
        }

        Map<String, Object> result = new java.util.HashMap<>();
        result.put("status", loan.getStatus().name());
        result.put("loanId", loan.getId());
        return result;
    }

    @Transactional
    public Map<String, Object> completeDisbursement(Long loanId) {
        Loan loan = loanRepository.findByIdForUpdate(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getStatus() != Loan.LoanStatus.AGREEMENT_SIGNED) {
            throw new RuntimeException("Loan is not in AGREEMENT_SIGNED state");
        }

        loan.setStatus(Loan.LoanStatus.ACTIVE);
        loan.setDisbursedAt(LocalDateTime.now());
        if (loan.getDueDate() == null) {
            loan.setDueDate(LocalDateTime.now().plusMonths(loan.getRepaymentPeriodMonths()));
        }

        circleMemberRepository.findByCircleAndUserId(loan.getCircle(), loan.getBorrowerId()).ifPresent(m -> {
            m.setLoansReceivedInCircle(m.getLoansReceivedInCircle() + 1);
            circleMemberRepository.save(m);
        });
        if (loan.getLenderId() != null) {
            circleMemberRepository.findByCircleAndUserId(loan.getCircle(), loan.getLenderId()).ifPresent(m -> {
                m.setLoansGivenInCircle(m.getLoansGivenInCircle() + 1);
                circleMemberRepository.save(m);
            });
        }

        loan = loanRepository.save(loan);
        installmentService.generateInstallments(loan);
        syncLoanCountStats(loan.getBorrowerId(), loan.getLenderId());

        expenseServiceClient.logTransaction(
                loan.getBorrowerId(),
                "Loan received - " + loan.getCircle().getName(),
                loan.getAmount(),
                "Loan",
                "INCOME"
        );

        Map<String, Object> result = new java.util.HashMap<>();
        result.put("status", loan.getStatus().name());
        result.put("disbursedAt", loan.getDisbursedAt());
        result.put("dueDate", loan.getDueDate());
        return result;
    }

    @Transactional
    public Map<String, Object> completeRepayment(Long loanId, Double amount) {
        if (amount == null || amount <= 0) {
            throw new RuntimeException("Repayment amount must be a positive number");
        }

        Loan loan = loanRepository.findByIdForUpdate(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        double totalOwed = loan.getTotalRepaymentAmount() + loan.getOverdueInterestAccrued();
        double alreadyOwed = totalOwed - loan.getAmountRepaid();
        if (amount > alreadyOwed + 0.01) {
            throw new RuntimeException("Repayment amount exceeds total owed. Owed: " + String.format("%.2f", alreadyOwed));
        }

        loan.setAmountRepaid(Math.round((loan.getAmountRepaid() + amount) * 100.0) / 100.0);

        expenseServiceClient.logTransaction(
                loan.getBorrowerId(),
                "Loan repayment - " + loan.getCircle().getName(),
                amount,
                "Loan",
                "EXPENSE"
        );
        if (loan.getLenderId() != null) {
            expenseServiceClient.logTransaction(
                    loan.getLenderId(),
                    "Repayment received - " + loan.getCircle().getName(),
                    amount,
                    "Loan",
                    "INCOME"
            );
        } else if (loan.getIsGroupFunded()) {
            groupFundingService.distributeGroupRepayment(loan, amount);
        }

        Map<String, Object> result = new java.util.HashMap<>();

        if (loan.getAmountRepaid() >= totalOwed) {
            loan.setStatus(Loan.LoanStatus.REPAID);
            loan.setCompletedAt(LocalDateTime.now());
            boolean onTime = loan.getGracePeriodStart() == null;
            trustScoreService.updateScoreOnRepayment(loan.getBorrowerId(), loan, onTime);

            circleMemberRepository.findByCircleAndUserId(loan.getCircle(), loan.getBorrowerId()).ifPresent(m -> {
                m.setLoansRepaidInCircle(m.getLoansRepaidInCircle() + 1);
                circleMemberRepository.save(m);
            });
            result.put("fullyRepaid", true);
        } else {
            result.put("fullyRepaid", false);
        }

        loan = loanRepository.save(loan);
        result.put("status", loan.getStatus().name());
        result.put("amountRepaid", loan.getAmountRepaid());
        result.put("remaining", Math.round((totalOwed - loan.getAmountRepaid()) * 100.0) / 100.0);
        return result;
    }

    // Scales a circle's base group-funding threshold by the borrower's trust
    // tier -- the same tiers that cap interest rate (see computeInterestRateTier
    // below). A higher-trust borrower can be trusted for more from a single
    // lender before the risk needs spreading across a group; a lower-trust
    // borrower hits that requirement sooner. Mirrored in the frontend
    // (RequestLoanScreen) for the pre-submit warning -- keep both in sync.
    public double effectiveGroupFundingThreshold(double baseThreshold, Double trustScore) {
        double score = trustScore != null ? trustScore : 50.0;
        if (score >= 90) return baseThreshold * 2.0;
        if (score >= 70) return baseThreshold * 1.5;
        if (score >= 50) return baseThreshold;
        return baseThreshold * 0.5;
    }

    private record InterestRateTier(String label, double maxRate) {}

    private InterestRateTier computeInterestRateTier(Double trustScore) {
        if (trustScore == null) trustScore = 50.0;
        if (trustScore >= 90) return new InterestRateTier("Excellent (90+)", 5);
        if (trustScore >= 70) return new InterestRateTier("Good (70-89)", 10);
        if (trustScore >= 50) return new InterestRateTier("Fair (50-69)", 15);
        return new InterestRateTier("Low (<50)", 25);
    }

    private Map<Long, Map<String, Object>> fetchUsersForLoans(List<Loan> loans) {
        Set<Long> userIds = new HashSet<>();
        for (Loan loan : loans) {
            userIds.add(loan.getBorrowerId());
            if (loan.getLenderId() != null) {
                userIds.add(loan.getLenderId());
            }
        }
        return authServiceClient.getUsersInfo(userIds);
    }

    private LoanResponse mapToLoanResponse(Loan loan, String message) {
        return mapToLoanResponse(loan, message, fetchUsersForLoans(List.of(loan)));
    }

    private LoanResponse mapToLoanResponse(Loan loan, String message, Map<Long, Map<String, Object>> users) {
        Map<String, Object> borrowerInfo = users.get(loan.getBorrowerId());
        Map<String, Object> lenderInfo = loan.getLenderId() != null ? users.get(loan.getLenderId()) : null;
        String borrowerName = AuthServiceClient.nameOf(borrowerInfo);
        String lenderName = AuthServiceClient.nameOf(lenderInfo);
        LoanAgreement agreement = loanAgreementRepository.findByLoan(loan).orElse(null);
        InterestRateTier borrowerTier = computeInterestRateTier(AuthServiceClient.trustScoreOf(borrowerInfo));
        return LoanResponse.builder()
                .id(loan.getId())
                .borrowerName(borrowerName)
                .borrowerId(loan.getBorrowerId())
                .lenderName(lenderName)
                .lenderId(loan.getLenderId())
                .circleName(loan.getCircle().getName())
                .circleId(loan.getCircle().getId())
                .amount(loan.getAmount())
                .reason(loan.getReason())
                .interestRate(loan.getInterestRate())
                .counterOfferRate(loan.getCounterOfferRate())
                .totalRepaymentAmount(loan.getTotalRepaymentAmount())
                .amountRepaid(loan.getAmountRepaid())
                .overdueInterestAccrued(loan.getOverdueInterestAccrued())
                .repaymentType(loan.getRepaymentType().name())
                .repaymentPeriodMonths(loan.getRepaymentPeriodMonths())
                .status(loan.getStatus().name())
                .isGroupFunded(loan.getIsGroupFunded())
                .dueDate(loan.getDueDate())
                .gracePeriodEnd(loan.getGracePeriodEnd())
                .createdAt(loan.getCreatedAt())
                .disbursedAt(loan.getDisbursedAt())
                .platformFee(loan.getPlatformFee())
                .borrowerReceivedAmount(loan.getBorrowerReceivedAmount())
                .message(message)
                .borrowerSigned(agreement != null ? agreement.getBorrowerSigned() : false)
                .lenderSigned(agreement != null ? agreement.getLenderSigned() : false)
                .borrowerMaxInterestRate(borrowerTier.maxRate())
                .borrowerTrustTier(borrowerTier.label())
                .build();
    }

    public Map<String, Object> getBorrowerInsights(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        List<Loan> loans = loanRepository.findByBorrowerIdOrderByCreatedAtDesc(userId).stream()
                .filter(l -> FUNDED_STATUSES.contains(l.getStatus()))
                .collect(Collectors.toList());

        int totalLoansTaken = loans.size();
        long activeLoans = loans.stream().filter(l -> ACTIVE_STATUSES.contains(l.getStatus())).count();
        double totalAmountBorrowed = loans.stream().mapToDouble(Loan::getAmount).sum();
        double totalInterestPaid = loans.stream()
                .filter(l -> l.getStatus() == Loan.LoanStatus.REPAID)
                .mapToDouble(l -> l.getTotalRepaymentAmount() - l.getAmount())
                .sum();
        long repaidCount = loans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.REPAID).count();
        double repaymentRate = totalLoansTaken == 0 ? 0.0 : Math.round((double) repaidCount / totalLoansTaken * 1000.0) / 10.0;
        double averageLoanSize = totalLoansTaken == 0 ? 0.0 : Math.round(totalAmountBorrowed / totalLoansTaken * 100.0) / 100.0;

        Map<String, Object> result = new java.util.HashMap<>();
        result.put("totalLoansTaken", totalLoansTaken);
        result.put("activeLoans", activeLoans);
        result.put("totalAmountBorrowed", totalAmountBorrowed);
        result.put("totalInterestPaid", totalInterestPaid);
        result.put("repaymentRate", repaymentRate);
        result.put("averageLoanSize", averageLoanSize);
        return result;
    }

    public Map<String, Object> getLenderInsights(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        List<Loan> loans = loanRepository.findByLenderIdOrderByCreatedAtDesc(userId).stream()
                .filter(l -> FUNDED_STATUSES.contains(l.getStatus()))
                .collect(Collectors.toList());

        int totalLoansGiven = loans.size();
        long activeLoans = loans.stream().filter(l -> ACTIVE_STATUSES.contains(l.getStatus())).count();
        double totalAmountLent = loans.stream().mapToDouble(Loan::getAmount).sum();
        double totalInterestEarned = loans.stream()
                .filter(l -> l.getStatus() == Loan.LoanStatus.REPAID)
                .mapToDouble(l -> l.getTotalRepaymentAmount() - l.getAmount())
                .sum();
        double returnRate = totalAmountLent == 0 ? 0.0 : Math.round(totalInterestEarned / totalAmountLent * 1000.0) / 10.0;
        double totalAmountAtRisk = loans.stream()
                .filter(l -> ACTIVE_STATUSES.contains(l.getStatus()))
                .mapToDouble(l -> l.getTotalRepaymentAmount() + l.getOverdueInterestAccrued() - l.getAmountRepaid())
                .sum();

        Map<String, Object> result = new java.util.HashMap<>();
        result.put("totalLoansGiven", totalLoansGiven);
        result.put("activeLoans", activeLoans);
        result.put("totalAmountLent", totalAmountLent);
        result.put("totalInterestEarned", totalInterestEarned);
        result.put("returnRate", returnRate);
        result.put("totalAmountAtRisk", totalAmountAtRisk);
        return result;
    }
}
