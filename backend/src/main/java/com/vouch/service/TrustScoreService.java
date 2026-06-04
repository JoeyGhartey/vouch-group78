// package com.vouch.service;

// import com.vouch.entity.Loan;
// import com.vouch.entity.User;
// import com.vouch.repository.UserRepository;
// import lombok.RequiredArgsConstructor;
// import org.springframework.stereotype.Service;

// @Service
// @RequiredArgsConstructor
// public class TrustScoreService {

//     private final UserRepository userRepository;

//     public void updateScoreOnRepayment(User borrower, Loan loan, boolean onTime) {
//         double currentScore = borrower.getTrustScore();
//         double adjustment;

//         if (onTime) {
//             double sizeWeight = Math.min(loan.getAmount() / 500.0, 2.0);
//             adjustment = 2.0 * sizeWeight;
//         } else {
//             double sizeWeight = Math.min(loan.getAmount() / 500.0, 2.0);
//             adjustment = 0.5 * sizeWeight;
//         }

//         double newScore = Math.min(100.0, currentScore + adjustment);
//         borrower.setTrustScore(newScore);
//         userRepository.save(borrower);
//     }

//     public void updateScoreOnDefault(User borrower, Loan loan) {
//         double currentScore = borrower.getTrustScore();
//         double sizeWeight = Math.min(loan.getAmount() / 500.0, 3.0);
//         double penalty = 10.0 * sizeWeight;

//         double newScore = Math.max(0.0, currentScore - penalty);
//         borrower.setTrustScore(newScore);
//         userRepository.save(borrower);
//     }

//     public double calculateScore(User user) {
//         if (user.getTotalLoansReceived() == 0) {
//             return 50.0;
//         }

//         double repaymentRatio = (double) user.getLoansRepaidOnTime() / user.getTotalLoansReceived();
//         double defaultPenalty = user.getDefaults() * 15.0;
//         double baseScore = 50.0 + (repaymentRatio * 40.0) - defaultPenalty;

//         return Math.max(0.0, Math.min(100.0, baseScore));
//     }
// }




package com.vouch.service;

import com.vouch.entity.CircleMember;
import com.vouch.entity.Loan;
import com.vouch.entity.User;
import com.vouch.repository.CircleMemberRepository;
import com.vouch.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TrustScoreService {

    private final UserRepository userRepository;
    private final CircleMemberRepository circleMemberRepository;

    public void updateScoreOnRepayment(User borrower, Loan loan, boolean onTime) {
        // Update global score
        double currentScore = borrower.getTrustScore();
        double sizeWeight = Math.min(loan.getAmount() / 500.0, 2.0);
        double adjustment = onTime ? 2.0 * sizeWeight : 0.5 * sizeWeight;

        borrower.setTrustScore(Math.min(100.0, currentScore + adjustment));
        userRepository.save(borrower);

        // Update circle-specific score
        circleMemberRepository.findByCircleAndUser(loan.getCircle(), borrower).ifPresent(member -> {
            double circleScore = member.getCircleTrustScore();
            double circleAdjustment = onTime ? 3.0 * sizeWeight : 0.5 * sizeWeight;
            member.setCircleTrustScore(Math.min(100.0, circleScore + circleAdjustment));
            circleMemberRepository.save(member);
        });
    }

    public void updateScoreOnDefault(User borrower, Loan loan) {
        // Update global score
        double currentScore = borrower.getTrustScore();
        double sizeWeight = Math.min(loan.getAmount() / 500.0, 3.0);
        double penalty = 10.0 * sizeWeight;

        borrower.setTrustScore(Math.max(0.0, currentScore - penalty));
        userRepository.save(borrower);

        // Update circle-specific score
        circleMemberRepository.findByCircleAndUser(loan.getCircle(), borrower).ifPresent(member -> {
            double circleScore = member.getCircleTrustScore();
            double circlePenalty = 15.0 * sizeWeight; // Heavier penalty in-circle
            member.setCircleTrustScore(Math.max(0.0, circleScore - circlePenalty));
            circleMemberRepository.save(member);
        });
    }

    public double calculateScore(User user) {
        if (user.getTotalLoansReceived() == 0) {
            return 50.0;
        }

        double repaymentRatio = (double) user.getLoansRepaidOnTime() / user.getTotalLoansReceived();
        double defaultPenalty = user.getDefaults() * 15.0;
        double baseScore = 50.0 + (repaymentRatio * 40.0) - defaultPenalty;

        return Math.max(0.0, Math.min(100.0, baseScore));
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