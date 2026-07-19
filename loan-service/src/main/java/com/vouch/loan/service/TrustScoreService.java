package com.vouch.loan.service;

import com.vouch.loan.entity.CircleMember;
import com.vouch.loan.entity.Loan;
import com.vouch.loan.repository.CircleMemberRepository;
import com.vouch.loan.repository.LoanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TrustScoreService {

    private final CircleMemberRepository circleMemberRepository;
    private final LoanRepository loanRepository;
    private final AuthServiceClient authServiceClient;

    public void updateScoreOnRepayment(Long borrowerId, Loan loan, boolean onTime) {
        double sizeWeight = Math.min(loan.getAmount() / 500.0, 2.0);

        // Circle-level score only applies if the borrower is still a tracked
        // member of this specific circle — but the global trust score (shown
        // on the Profile screen) must update regardless of that, since it's
        // not scoped to any one circle. Previously this was nested inside the
        // circle-membership Optional, so a missing/stale membership row
        // silently skipped the global update too.
        circleMemberRepository.findByCircleAndUserId(loan.getCircle(), borrowerId).ifPresent(member -> {
            double circleScore = member.getCircleTrustScore();
            double circleAdjustment = onTime ? 3.0 * sizeWeight : 0.5 * sizeWeight;
            member.setCircleTrustScore(Math.min(100.0, circleScore + circleAdjustment));
            circleMemberRepository.save(member);
        });

        int repaidCount = loanRepository.findByBorrowerIdAndStatus(borrowerId, Loan.LoanStatus.REPAID).size();
        int defaultCount = loanRepository.findByBorrowerIdAndStatus(borrowerId, Loan.LoanStatus.DEFAULTED).size();
        double newGlobalScore = Math.min(100.0, authServiceClient.getUserTrustScore(borrowerId)
                + (onTime ? 2.0 * sizeWeight : 0.25 * sizeWeight));
        authServiceClient.updateUserStats(borrowerId, newGlobalScore, repaidCount, defaultCount);
    }

    public void updateScoreOnDefault(Long borrowerId, Loan loan) {
        double sizeWeight = Math.min(loan.getAmount() / 500.0, 3.0);

        circleMemberRepository.findByCircleAndUserId(loan.getCircle(), borrowerId).ifPresent(member -> {
            double circleScore = member.getCircleTrustScore();
            double circlePenalty = 15.0 * sizeWeight;
            member.setCircleTrustScore(Math.max(0.0, circleScore - circlePenalty));
            circleMemberRepository.save(member);
        });

        int repaidCount = loanRepository.findByBorrowerIdAndStatus(borrowerId, Loan.LoanStatus.REPAID).size();
        int defaultCount = loanRepository.findByBorrowerIdAndStatus(borrowerId, Loan.LoanStatus.DEFAULTED).size();
        double newGlobalScore = Math.max(0.0, authServiceClient.getUserTrustScore(borrowerId)
                - 10.0 * sizeWeight);
        authServiceClient.updateUserStats(borrowerId, newGlobalScore, repaidCount, defaultCount);

        // Enforce the consequences every loan agreement's terms actually promise:
        // 2nd default -> 30-day borrowing suspension, 3rd (or later) -> permanent ban.
        if (defaultCount == 2) {
            authServiceClient.applyDefaultConsequences(borrowerId, java.time.LocalDateTime.now().plusDays(30), false);
        } else if (defaultCount >= 3) {
            authServiceClient.applyDefaultConsequences(borrowerId, null, true);
        }
    }

    public double calculateCircleScore(CircleMember member) {
        int received = member.getLoansReceivedInCircle();
        if (received == 0) return 50.0;

        double repaymentRatio = (double) member.getLoansRepaidInCircle() / received;
        double defaultPenalty = member.getDefaultsInCircle() * 20.0;
        double baseScore = 50.0 + (repaymentRatio * 40.0) - defaultPenalty;

        return Math.max(0.0, Math.min(100.0, baseScore));
    }
}
