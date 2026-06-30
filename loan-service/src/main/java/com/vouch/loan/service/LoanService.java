package com.vouch.loan.service;

import com.vouch.loan.dto.*;
import com.vouch.loan.entity.*;
import com.vouch.loan.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
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
    private static final double PLATFORM_FEE_PERCENT = 2.0;

    @Transactional
    public LoanResponse requestLoan(String phone, LoanRequest request) {
        Long borrowerId = authServiceClient.getUserIdByPhone(phone);
        Map<String, Object> borrowerInfo = authServiceClient.getUserInfo(borrowerId);
        Circle circle = circleRepository.findById(request.getCircleId())
                .orElseThrow(() -> new RuntimeException("Circle not found"));

        circleService.validateMembership(circle, borrowerId);

        if (Boolean.TRUE.equals(borrowerInfo.get("permanentBan"))) {
            throw new RuntimeException("You are permanently banned from borrowing");
        }
        if (Boolean.TRUE.equals(borrowerInfo.get("borrowingSuspended"))) {
            throw new RuntimeException("Your borrowing is currently suspended");
        }
        Double trustScore = ((Number) borrowerInfo.get("trustScore")).doubleValue();
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
        if (request.getDueDate() != null) {
            dueDate = LocalDateTime.parse(request.getDueDate(), DateTimeFormatter.ISO_DATE_TIME);
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
                .isGroupFunded(request.getAmount() >= circle.getGroupFundingThreshold())
                .build();

        loan = loanRepository.save(loan);
        return mapToLoanResponse(loan, "Loan request posted to circle");
    }

    @Transactional
    public LoanResponse fundLoan(String phone, FundLoanRequest request) {
        Long lenderId = authServiceClient.getUserIdByPhone(phone);
        Loan loan = loanRepository.findById(request.getLoanId())
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getStatus() != Loan.LoanStatus.REQUESTED) {
            throw new RuntimeException("This loan is not available for funding");
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
        Loan loan = loanRepository.findById(loanId)
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
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getStatus() != Loan.LoanStatus.AGREEMENT_SIGNED) {
            throw new RuntimeException("Agreement must be signed by both parties before disbursement");
        }

        if (loan.getLenderId() == null || !userId.equals(loan.getLenderId())) {
            throw new RuntimeException("Only the lender can trigger disbursement");
        }

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
        return mapToLoanResponse(loan, "Loan disbursed and active. Platform fee: GHS " + String.format("%.2f", platformFee) + ". Borrower receives: GHS " + String.format("%.2f", amountAfterFee));
    }

    @Transactional
    public LoanResponse repayLoan(String phone, Long loanId, Double amount) {
        Long borrowerId = authServiceClient.getUserIdByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
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
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getLenderId() == null || !lenderId.equals(loan.getLenderId())) {
            throw new RuntimeException("Only the lender can mark a loan as defaulted");
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
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (!userId.equals(loan.getBorrowerId())) {
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
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));
        circleService.validateMembership(circle, userId);
        return loanRepository.findByCircle(circle).stream()
                .map(l -> mapToLoanResponse(l, null))
                .collect(Collectors.toList());
    }

    public List<LoanResponse> getCircleLoanRequests(String phone, Long circleId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));
        circleService.validateMembership(circle, userId);
        return loanRepository.findByCircleAndStatus(circle, Loan.LoanStatus.REQUESTED).stream()
                .map(l -> mapToLoanResponse(l, null))
                .collect(Collectors.toList());
    }

    public List<LoanResponse> getMyLoansAsBorrower(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        return loanRepository.findByBorrowerId(userId).stream()
                .map(l -> mapToLoanResponse(l, null))
                .collect(Collectors.toList());
    }

    public List<LoanResponse> getMyLoansAsLender(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        return loanRepository.findByLenderId(userId).stream()
                .map(l -> mapToLoanResponse(l, null))
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
        String borrowerName = authServiceClient.getUserName(loan.getBorrowerId());
        String borrowerPhone = authServiceClient.getUserPhone(loan.getBorrowerId());
        String lenderName = authServiceClient.getUserName(loan.getLenderId());
        String lenderPhone = authServiceClient.getUserPhone(loan.getLenderId());

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
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));
        loan.setStatus(Loan.LoanStatus.DISPUTED);
        loanRepository.save(loan);
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("status", loan.getStatus().name());
        result.put("loanId", loan.getId());
        return result;
    }

    @Transactional
    public Map<String, Object> completeDisbursement(Long loanId) {
        Loan loan = loanRepository.findById(loanId)
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

        Map<String, Object> result = new java.util.HashMap<>();
        result.put("status", loan.getStatus().name());
        result.put("disbursedAt", loan.getDisbursedAt());
        result.put("dueDate", loan.getDueDate());
        return result;
    }

    @Transactional
    public Map<String, Object> completeRepayment(Long loanId, Double amount) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        loan.setAmountRepaid(Math.round((loan.getAmountRepaid() + amount) * 100.0) / 100.0);
        double totalOwed = loan.getTotalRepaymentAmount() + loan.getOverdueInterestAccrued();

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

    private LoanResponse mapToLoanResponse(Loan loan, String message) {
        String borrowerName = authServiceClient.getUserName(loan.getBorrowerId());
        String lenderName = loan.getLenderId() != null ? authServiceClient.getUserName(loan.getLenderId()) : null;
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
