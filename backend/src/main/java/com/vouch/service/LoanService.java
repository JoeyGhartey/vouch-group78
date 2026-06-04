package com.vouch.service;

import com.vouch.dto.*;
import com.vouch.entity.*;
import com.vouch.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

// import javax.management.Notification;

@Service
@RequiredArgsConstructor
public class LoanService {

    private final LoanRepository loanRepository;
    private final LoanAgreementRepository loanAgreementRepository;
    private final LoanContributionRepository loanContributionRepository;
    private final CircleRepository circleRepository;
    private final CircleMemberRepository circleMemberRepository;
    private final UserRepository userRepository;
    private final CircleService circleService;
    private final TrustScoreService trustScoreService;
    private final InstallmentService installmentService;
    private final NotificationService notificationService;
    private static final double PLATFORM_FEE_PERCENT = 2.0; // 2% platform fee
    @Transactional
    public LoanResponse requestLoan(String phone, LoanRequest request) {
        User borrower = getUserByPhone(phone);
        Circle circle = circleRepository.findById(request.getCircleId())
                .orElseThrow(() -> new RuntimeException("Circle not found"));

        circleService.validateMembership(circle, borrower);

        // Validate borrower status
        if (borrower.getPermanentBan()) {
            throw new RuntimeException("You are permanently banned from borrowing");
        }
        if (borrower.getBorrowingSuspended() && borrower.getBorrowingSuspendedUntil() != null
                && borrower.getBorrowingSuspendedUntil().isAfter(LocalDateTime.now())) {
            throw new RuntimeException("Your borrowing is suspended until " + borrower.getBorrowingSuspendedUntil());
        }
        if (borrower.getTrustScore() < 20) {
            throw new RuntimeException("Your trust score is too low to borrow. Repay outstanding loans to recover.");
        }

        // Validate amount
        if (request.getAmount() <= 0) {
            throw new RuntimeException("Loan amount must be greater than zero");
        }
        if (request.getAmount() > circle.getMaxLoanAmount()) {
            throw new RuntimeException("Amount exceeds circle's maximum loan amount of " + circle.getMaxLoanAmount());
        }

        // Check for existing active loans from same borrower in same circle
        List<Loan> existingActiveLoans = loanRepository.findByBorrowerAndStatus(borrower, Loan.LoanStatus.ACTIVE);
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

        // Validate repayment period
        int repaymentPeriod = request.getRepaymentPeriodMonths() != null ? request.getRepaymentPeriodMonths() : 1;
        if (repaymentPeriod < 1 || repaymentPeriod > 12) {
            throw new RuntimeException("Repayment period must be between 1 and 12 months");
        }

        LocalDateTime dueDate = null;
        if (request.getDueDate() != null) {
            dueDate = LocalDateTime.parse(request.getDueDate(), DateTimeFormatter.ISO_DATE_TIME);
            if (dueDate.isBefore(LocalDateTime.now())) {
                throw new RuntimeException("Due date cannot be in the past");
            }
        }

        Loan loan = Loan.builder()
                .borrower(borrower)
                .circle(circle)
                .amount(request.getAmount())
                .reason(request.getReason())
                .repaymentType(repaymentType)
                .repaymentPeriodMonths(repaymentPeriod)
                .dueDate(dueDate)
                .status(Loan.LoanStatus.REQUESTED)
                .isGroupFunded(request.getAmount() >= circle.getGroupFundingThreshold())
                .build();

        loan = loanRepository.save(loan);
        return mapToLoanResponse(loan, "Loan request posted to circle");
    }

    @Transactional
    public LoanResponse fundLoan(String phone, FundLoanRequest request) {
        User lender = getUserByPhone(phone);
        Loan loan = loanRepository.findById(request.getLoanId())
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getStatus() != Loan.LoanStatus.REQUESTED) {
            throw new RuntimeException("This loan is not available for funding");
        }

        circleService.validateMembership(loan.getCircle(), lender);

        if (lender.getId().equals(loan.getBorrower().getId())) {
            throw new RuntimeException("You cannot fund your own loan");
        }

        // Validate interest rate
        if (request.getInterestRate() < 0) {
            throw new RuntimeException("Interest rate cannot be negative");
        }
        if (request.getInterestRate() > 50) {
            throw new RuntimeException("Interest rate cannot exceed 50% to prevent predatory lending");
        }

        loan.setLender(lender);
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
        User signer = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getStatus() != Loan.LoanStatus.AGREEMENT_PENDING) {
            throw new RuntimeException("This loan is not in agreement signing stage");
        }

        LoanAgreement agreement = loanAgreementRepository.findByLoan(loan)
                .orElseThrow(() -> new RuntimeException("Agreement not found"));

        if (signer.getId().equals(loan.getBorrower().getId())) {
            if (agreement.getBorrowerSigned()) {
                throw new RuntimeException("You have already signed this agreement");
            }
            agreement.setBorrowerSigned(true);
            agreement.setBorrowerSignedAt(LocalDateTime.now());
        } else if (loan.getLender() != null && signer.getId().equals(loan.getLender().getId())) {
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
        User user = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getStatus() != Loan.LoanStatus.AGREEMENT_SIGNED) {
            throw new RuntimeException("Agreement must be signed by both parties before disbursement");
        }

        if (loan.getLender() == null || !user.getId().equals(loan.getLender().getId())) {
            throw new RuntimeException("Only the lender can trigger disbursement");
        }

// Calculate platform fee
        double platformFee = Math.round(loan.getAmount() * PLATFORM_FEE_PERCENT / 100 * 100.0) / 100.0;
        double amountAfterFee = loan.getAmount() - platformFee;
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

        // Update circle member stats
        CircleMember borrowerMember = circleMemberRepository.findByCircleAndUser(loan.getCircle(), loan.getBorrower())
                .orElse(null);
        if (borrowerMember != null) {
            borrowerMember.setLoansReceivedInCircle(borrowerMember.getLoansReceivedInCircle() + 1);
            circleMemberRepository.save(borrowerMember);
        }

        CircleMember lenderMember = circleMemberRepository.findByCircleAndUser(loan.getCircle(), loan.getLender())
                .orElse(null);
        if (lenderMember != null) {
            lenderMember.setLoansGivenInCircle(lenderMember.getLoansGivenInCircle() + 1);
            circleMemberRepository.save(lenderMember);
        }

        // Update user stats
        User borrower = loan.getBorrower();
        borrower.setTotalLoansReceived(borrower.getTotalLoansReceived() + 1);
        userRepository.save(borrower);

        User lender = loan.getLender();
        lender.setTotalLoansGiven(lender.getTotalLoansGiven() + 1);
        userRepository.save(lender);

        loan = loanRepository.save(loan);
        installmentService.generateInstallments(loan);
	return mapToLoanResponse(loan, "Loan disbursed and active. Platform fee: GHS " + String.format("%.2f", platformFee) + ". Borrower 	receives: GHS " + String.format("%.2f", amountAfterFee));    }

    @Transactional
    public LoanResponse repayLoan(String phone, Long loanId, Double amount) {
        User borrower = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (!borrower.getId().equals(loan.getBorrower().getId())) {
            throw new RuntimeException("Only the borrower can repay this loan");
        }

        if (loan.getStatus() != Loan.LoanStatus.ACTIVE &&
            loan.getStatus() != Loan.LoanStatus.DUE &&
            loan.getStatus() != Loan.LoanStatus.GRACE_PERIOD) {
            throw new RuntimeException("This loan is not in a repayable state");
        }

        double totalOwed = loan.getTotalRepaymentAmount() + loan.getOverdueInterestAccrued() - loan.getAmountRepaid();
        double repayAmount = amount != null ? amount : totalOwed;

        // Validate repayment amount
        if (repayAmount <= 0) {
            throw new RuntimeException("Repayment amount must be greater than zero");
        }
        if (repayAmount > totalOwed) {
            throw new RuntimeException("Repayment amount exceeds total owed. You owe " + String.format("%.2f", totalOwed));
        }

        loan.setAmountRepaid(Math.round((loan.getAmountRepaid() + repayAmount) * 100.0) / 100.0);

        if (loan.getAmountRepaid() >= loan.getTotalRepaymentAmount() + loan.getOverdueInterestAccrued()) {
            loan.setStatus(Loan.LoanStatus.REPAID);
            loan.setCompletedAt(LocalDateTime.now());

            boolean onTime = loan.getGracePeriodStart() == null;
            trustScoreService.updateScoreOnRepayment(loan.getBorrower(), loan, onTime);

            // Update circle stats
            CircleMember borrowerMember = circleMemberRepository.findByCircleAndUser(loan.getCircle(), loan.getBorrower())
                    .orElse(null);
            if (borrowerMember != null) {
                borrowerMember.setLoansRepaidInCircle(borrowerMember.getLoansRepaidInCircle() + 1);
                circleMemberRepository.save(borrowerMember);
            }

            borrower.setLoansRepaidOnTime(borrower.getLoansRepaidOnTime() + (onTime ? 1 : 0));
            userRepository.save(borrower);

            loan = loanRepository.save(loan);
            return mapToLoanResponse(loan, "Loan fully repaid.");
        }

        loan = loanRepository.save(loan);
        double remaining = totalOwed - repayAmount;
        return mapToLoanResponse(loan, "Partial repayment recorded. Remaining: " + String.format("%.2f", remaining));
    }

    @Transactional
    public LoanResponse defaultLoan(String phone, Long loanId) {
        User lender = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getLender() == null || !lender.getId().equals(loan.getLender().getId())) {
            throw new RuntimeException("Only the lender can mark a loan as defaulted");
        }

        if (loan.getStatus() != Loan.LoanStatus.GRACE_PERIOD) {
            throw new RuntimeException("Loan can only be defaulted after entering the grace period");
        }

        // Check if grace period has actually expired
        if (loan.getGracePeriodEnd() != null && loan.getGracePeriodEnd().isAfter(LocalDateTime.now())) {
            throw new RuntimeException("Grace period has not expired yet. Expires at " + loan.getGracePeriodEnd());
        }

        loan.setStatus(Loan.LoanStatus.DEFAULTED);
        loan.setDefaultedAt(LocalDateTime.now());

        // Update trust score
        trustScoreService.updateScoreOnDefault(loan.getBorrower(), loan);

        // Apply escalating consequences
        User borrower = loan.getBorrower();
        borrower.setDefaults(borrower.getDefaults() + 1);

        if (borrower.getDefaults() >= 3) {
            borrower.setPermanentBan(true);
        } else if (borrower.getDefaults() >= 2) {
            borrower.setBorrowingSuspended(true);
            borrower.setBorrowingSuspendedUntil(LocalDateTime.now().plusDays(30));
        }

        userRepository.save(borrower);
        // Notify all circle members of the default
        List<CircleMember> circleMembers = circleMemberRepository.findByCircleAndStatus(
            loan.getCircle(), CircleMember.MemberStatus.ACTIVE);
        for (CircleMember member : circleMembers) {
            if (!member.getUser().getId().equals(borrower.getId())) {
                notificationService.send(
                    member.getUser(),
                    "Loan Default",
                    borrower.getFirstName() + " " + borrower.getLastName() +
                    " has defaulted on a loan in " + loan.getCircle().getName(),
                    Notification.NotificationType.LOAN_DEFAULTED,
                    loan.getId()
                );
            }
        }

        // Update circle stats
        CircleMember borrowerMember = circleMemberRepository.findByCircleAndUser(loan.getCircle(), loan.getBorrower())
                .orElse(null);
        if (borrowerMember != null) {
            borrowerMember.setDefaultsInCircle(borrowerMember.getDefaultsInCircle() + 1);
            circleMemberRepository.save(borrowerMember);
        }

        loan = loanRepository.save(loan);
        return mapToLoanResponse(loan, "Loan marked as defaulted. Borrower's trust score has been impacted.");
    }

    @Transactional
    public LoanResponse cancelLoan(String phone, Long loanId) {
        User user = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (!user.getId().equals(loan.getBorrower().getId())) {
            throw new RuntimeException("Only the borrower can cancel a loan request");
        }

        if (loan.getStatus() != Loan.LoanStatus.REQUESTED) {
            throw new RuntimeException("Only pending loan requests can be cancelled");
        }

        loan.setStatus(Loan.LoanStatus.CANCELLED);
        loan = loanRepository.save(loan);
        return mapToLoanResponse(loan, "Loan request cancelled.");
    }

    public List<LoanResponse> getCircleLoans(String phone, Long circleId) {
        User user = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));

        circleService.validateMembership(circle, user);

        return loanRepository.findByCircle(circle).stream()
                .map(l -> mapToLoanResponse(l, null))
                .collect(Collectors.toList());
    }

    public List<LoanResponse> getCircleLoanRequests(String phone, Long circleId) {
        User user = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));

        circleService.validateMembership(circle, user);

        return loanRepository.findByCircleAndStatus(circle, Loan.LoanStatus.REQUESTED).stream()
                .map(l -> mapToLoanResponse(l, null))
                .collect(Collectors.toList());
    }

    public List<LoanResponse> getMyLoansAsBorrower(String phone) {
        User user = getUserByPhone(phone);
        return loanRepository.findByBorrower(user).stream()
                .map(l -> mapToLoanResponse(l, null))
                .collect(Collectors.toList());
    }

    public List<LoanResponse> getMyLoansAsLender(String phone) {
        User user = getUserByPhone(phone);
        return loanRepository.findByLender(user).stream()
                .map(l -> mapToLoanResponse(l, null))
                .collect(Collectors.toList());
    }

    public LoanResponse getLoan(String phone, Long loanId) {
        User user = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        circleService.validateMembership(loan.getCircle(), user);
        return mapToLoanResponse(loan, null);
    }

    private void generateAgreement(Loan loan) {
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
                .borrowerName(loan.getBorrower().getFirstName() + " " + loan.getBorrower().getLastName())
                .borrowerPhone(loan.getBorrower().getPhone())
                .lenderName(loan.getLender().getFirstName() + " " + loan.getLender().getLastName())
                .lenderPhone(loan.getLender().getPhone())
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

    private User getUserByPhone(String phone) {
        return userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private LoanResponse mapToLoanResponse(Loan loan, String message) {
        return LoanResponse.builder()
                .id(loan.getId())
                .borrowerName(loan.getBorrower().getFirstName() + " " + loan.getBorrower().getLastName())
                .borrowerId(loan.getBorrower().getId())
                .lenderName(loan.getLender() != null ? loan.getLender().getFirstName() + " " + loan.getLender().getLastName() : null)
                .lenderId(loan.getLender() != null ? loan.getLender().getId() : null)
                .circleName(loan.getCircle().getName())
                .circleId(loan.getCircle().getId())
                .amount(loan.getAmount())
                .reason(loan.getReason())
                .interestRate(loan.getInterestRate())
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
                .message(message)
                .build();
    }
}
