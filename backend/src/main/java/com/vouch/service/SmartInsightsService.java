package com.vouch.service;

import com.vouch.entity.*;
import com.vouch.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SmartInsightsService {

    private final LoanRepository loanRepository;
    private final PersonalExpenseRepository personalExpenseRepository;
    private final CircleMemberRepository circleMemberRepository;
    private final CircleRepository circleRepository;
    private final UserRepository userRepository;

    public Map<String, Object> getBorrowerInsights(String phone) {
        User user = getUserByPhone(phone);
        List<Loan> loans = loanRepository.findByBorrower(user);
        Map<String, Object> insights = new HashMap<>();

        long total = loans.size();
        long active = loans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.ACTIVE || l.getStatus() == Loan.LoanStatus.DUE).count();
        double totalAmount = loans.stream().mapToDouble(Loan::getAmount).sum();
        double interestPaid = loans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.REPAID).mapToDouble(l -> l.getTotalRepaymentAmount() - l.getAmount()).sum();
        long repaid = loans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.REPAID).count();
        long defaulted = loans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.DEFAULTED).count();
        double repaymentRate = total > 0 ? (double) repaid / total * 100 : 0;

        insights.put("totalLoansTaken", total); insights.put("activeLoans", active);
        insights.put("totalAmountBorrowed", totalAmount); insights.put("totalInterestPaid", interestPaid);
        insights.put("loansRepaid", repaid); insights.put("loansDefaulted", defaulted);
        insights.put("repaymentRate", Math.round(repaymentRate * 10.0) / 10.0);
        insights.put("averageLoanSize", total > 0 ? Math.round(totalAmount / total * 100.0) / 100.0 : 0);

        List<String> recs = new ArrayList<>();
        if (defaulted > 0) recs.add("You have " + defaulted + " default(s). Focus on repaying to improve your score.");
        if (active >= 3) recs.add("You have " + active + " active loans. Consider repaying some first.");
        if (repaymentRate >= 90 && total >= 3) recs.add("Excellent repayment rate of " + Math.round(repaymentRate) + "%!");
        insights.put("recommendations", recs);
        return insights;
    }

    public Map<String, Object> getLenderInsights(String phone) {
        User user = getUserByPhone(phone);
        List<Loan> loans = loanRepository.findByLender(user);
        Map<String, Object> insights = new HashMap<>();

        long total = loans.size();
        double totalAmount = loans.stream().mapToDouble(Loan::getAmount).sum();
        double interestEarned = loans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.REPAID).mapToDouble(l -> l.getAmountRepaid() - l.getAmount()).sum();
        long active = loans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.ACTIVE || l.getStatus() == Loan.LoanStatus.DUE || l.getStatus() == Loan.LoanStatus.GRACE_PERIOD).count();
        long defaulted = loans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.DEFAULTED).count();
        long repaid = loans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.REPAID).count();
        double returnRate = total > 0 ? (double) repaid / total * 100 : 0;
        double totalAtRisk = loans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.ACTIVE || l.getStatus() == Loan.LoanStatus.DUE || l.getStatus() == Loan.LoanStatus.GRACE_PERIOD).mapToDouble(l -> l.getTotalRepaymentAmount() - l.getAmountRepaid()).sum();

        insights.put("totalLoansGiven", total); insights.put("activeLoans", active);
        insights.put("totalAmountLent", totalAmount); insights.put("totalInterestEarned", Math.round(interestEarned * 100.0) / 100.0);
        insights.put("loansRepaid", repaid); insights.put("loansDefaulted", defaulted);
        insights.put("returnRate", Math.round(returnRate * 10.0) / 10.0);
        insights.put("totalAmountAtRisk", Math.round(totalAtRisk * 100.0) / 100.0);

        List<String> recs = new ArrayList<>();
        if (defaulted > 0) recs.add("You have " + defaulted + " default(s). Consider lending to higher-score borrowers.");
        if (returnRate >= 90 && total >= 3) recs.add("Your return rate is excellent.");
        insights.put("recommendations", recs);
        return insights;
    }

    public Map<String, Object> getCircleInsights(String phone, Long circleId) {
        User user = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId).orElseThrow(() -> new RuntimeException("Circle not found"));

        circleMemberRepository.findByCircleAndUser(circle, user)
                .filter(m -> m.getStatus() == CircleMember.MemberStatus.ACTIVE)
                .orElseThrow(() -> new RuntimeException("Not an active member"));

        List<Loan> loans = loanRepository.findByCircle(circle);
        List<CircleMember> members = circleMemberRepository.findByCircleAndStatus(circle, CircleMember.MemberStatus.ACTIVE);
        Map<String, Object> insights = new HashMap<>();

        long repaid = loans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.REPAID).count();
        long defaulted = loans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.DEFAULTED).count();
        long active = loans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.ACTIVE || l.getStatus() == Loan.LoanStatus.DUE).count();
        double totalLent = loans.stream().mapToDouble(Loan::getAmount).sum();
        double rate = loans.size() > 0 ? (double) repaid / loans.size() * 100 : 0;
        double avgScore = members.stream().mapToDouble(CircleMember::getCircleTrustScore).average().orElse(50);

        insights.put("circleName", circle.getName()); insights.put("memberCount", members.size());
        insights.put("totalLoans", loans.size()); insights.put("activeLoans", active);
        insights.put("repaidLoans", repaid); insights.put("defaultedLoans", defaulted);
        insights.put("totalAmountCirculated", totalLent);
        insights.put("circleRepaymentRate", Math.round(rate * 10.0) / 10.0);
        insights.put("averageTrustScore", Math.round(avgScore * 10.0) / 10.0);

        String health = rate >= 90 ? "Excellent" : rate >= 70 ? "Good" : rate >= 50 ? "Fair" : "At Risk";
        insights.put("circleHealth", health);

        Map<String, Long> lenderCounts = loans.stream().filter(l -> l.getLender() != null).collect(Collectors.groupingBy(l -> l.getLender().getFirstName() + " " + l.getLender().getLastName(), Collectors.counting()));
        Map<String, Long> borrowerCounts = loans.stream().collect(Collectors.groupingBy(l -> l.getBorrower().getFirstName() + " " + l.getBorrower().getLastName(), Collectors.counting()));
        if (!lenderCounts.isEmpty()) insights.put("topLender", Collections.max(lenderCounts.entrySet(), Map.Entry.comparingByValue()).getKey());
        if (!borrowerCounts.isEmpty()) insights.put("topBorrower", Collections.max(borrowerCounts.entrySet(), Map.Entry.comparingByValue()).getKey());

        return insights;
    }

    private User getUserByPhone(String phone) { return userRepository.findByPhone(phone).orElseThrow(() -> new RuntimeException("User not found")); }
}
