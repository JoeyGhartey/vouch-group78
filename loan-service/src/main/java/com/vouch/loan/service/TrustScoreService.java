package com.vouch.loan.service;

import com.vouch.loan.entity.CircleMember;
import com.vouch.loan.entity.Loan;
import com.vouch.loan.repository.CircleMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TrustScoreService {

    private final CircleMemberRepository circleMemberRepository;

    public void updateScoreOnRepayment(Long borrowerId, Loan loan, boolean onTime) {
        double sizeWeight = Math.min(loan.getAmount() / 500.0, 2.0);

        circleMemberRepository.findByCircleAndUserId(loan.getCircle(), borrowerId).ifPresent(member -> {
            double circleScore = member.getCircleTrustScore();
            double circleAdjustment = onTime ? 3.0 * sizeWeight : 0.5 * sizeWeight;
            member.setCircleTrustScore(Math.min(100.0, circleScore + circleAdjustment));
            circleMemberRepository.save(member);
        });
    }

    public void updateScoreOnDefault(Long borrowerId, Loan loan) {
        double sizeWeight = Math.min(loan.getAmount() / 500.0, 3.0);

        circleMemberRepository.findByCircleAndUserId(loan.getCircle(), borrowerId).ifPresent(member -> {
            double circleScore = member.getCircleTrustScore();
            double circlePenalty = 15.0 * sizeWeight;
            member.setCircleTrustScore(Math.max(0.0, circleScore - circlePenalty));
            circleMemberRepository.save(member);
        });
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
