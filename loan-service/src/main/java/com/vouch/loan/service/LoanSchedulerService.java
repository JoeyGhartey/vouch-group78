package com.vouch.loan.service;

import com.vouch.loan.entity.CircleMember;
import com.vouch.loan.entity.Loan;
import com.vouch.loan.repository.CircleMemberRepository;
import com.vouch.loan.repository.LoanRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class LoanSchedulerService {

    private final LoanRepository loanRepository;
    private final CircleMemberRepository circleMemberRepository;
    private final NotificationServiceClient notificationServiceClient;
    private final AuthServiceClient authServiceClient;

    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void checkOverdueLoans() {
        log.info("Running overdue loan check...");
        checkActiveLoansForOverdue();
        calculateOverdueInterest();
        checkGracePeriodExpiry();
        log.info("Overdue loan check complete.");
    }

    // Runs every day at 9:00 AM
    @Scheduled(cron = "0 0 9 * * *")
    @Transactional
    public void sendGentleNudges() {
        log.info("Running Gentle Nudge check...");

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime twoDaysFromNow = now.plusDays(2);

        // Find all active loans due within the next 2 days
        List<Loan> upcomingLoans = loanRepository.findByStatus(Loan.LoanStatus.ACTIVE)
                .stream()
                .filter(loan -> loan.getDueDate() != null
                        && loan.getDueDate().isAfter(now)
                        && loan.getDueDate().isBefore(twoDaysFromNow))
                .toList();

        for (Loan loan : upcomingLoans) {
            try {
                String borrowerName = authServiceClient.getUserName(loan.getBorrowerId());
                long daysLeft = ChronoUnit.DAYS.between(now, loan.getDueDate());
                String timeLeft = daysLeft <= 0 ? "today" : daysLeft == 1 ? "tomorrow" : "in 2 days";

                String title = "💪 Gentle Nudge";
                String message = borrowerName + "'s loan of GHS "
                        + String.format("%.0f", loan.getAmount())
                        + " is due " + timeLeft
                        + ". Let's support them! 🤝";

                // Notify all active circle members
                List<CircleMember> members = circleMemberRepository
                        .findByCircleAndStatus(loan.getCircle(), CircleMember.MemberStatus.ACTIVE);

                for (CircleMember member : members) {
                    // Send to everyone including the borrower as a reminder
                    notificationServiceClient.send(
                            member.getUserId(),
                            title,
                            message,
                            "LOAN_REPAYMENT_REMINDER",
                            loan.getId()
                    );
                }

                log.info("Gentle Nudge sent for loan {} — {} members notified", loan.getId(), members.size());

            } catch (Exception e) {
                log.warn("Failed to send Gentle Nudge for loan {}: {}", loan.getId(), e.getMessage());
            }
        }

        log.info("Gentle Nudge check complete. {} loans processed.", upcomingLoans.size());
    }

    private void checkActiveLoansForOverdue() {
        List<Loan> activeLoans = loanRepository.findByStatus(Loan.LoanStatus.ACTIVE);
        for (Loan loan : activeLoans) {
            if (loan.getDueDate() != null && loan.getDueDate().isBefore(LocalDateTime.now())) {
                loan.setStatus(Loan.LoanStatus.DUE);
                loanRepository.save(loan);
                log.info("Loan {} marked as DUE", loan.getId());
            }
        }

        List<Loan> dueLoans = loanRepository.findByStatus(Loan.LoanStatus.DUE);
        for (Loan loan : dueLoans) {
            if (loan.getDueDate() != null && loan.getDueDate().plusHours(24).isBefore(LocalDateTime.now())) {
                loan.setStatus(Loan.LoanStatus.GRACE_PERIOD);
                loan.setGracePeriodStart(LocalDateTime.now());
                loan.setGracePeriodEnd(LocalDateTime.now().plusDays(7));
                loanRepository.save(loan);

                String borrowerName = authServiceClient.getUserName(loan.getBorrowerId());
                notificationServiceClient.send(loan.getBorrowerId(), "Grace Period Started",
                        "Your loan of GHS " + String.format("%.2f", loan.getAmount()) +
                                " is now in the 7-day grace period. Repay by " + loan.getGracePeriodEnd() + " to avoid default.",
                        "LOAN_GRACE_PERIOD", loan.getId());

                if (loan.getLenderId() != null) {
                    notificationServiceClient.send(loan.getLenderId(), "Borrower Entered Grace Period",
                            borrowerName + "'s loan of GHS " + String.format("%.2f", loan.getAmount()) +
                                    " has entered the grace period. They have until " + loan.getGracePeriodEnd() + " to repay.",
                            "LOAN_GRACE_PERIOD", loan.getId());
                }

                log.info("Loan {} entered GRACE_PERIOD. Ends at {}", loan.getId(), loan.getGracePeriodEnd());
            }
        }
    }

    private void calculateOverdueInterest() {
        List<Loan> gracePeriodLoans = loanRepository.findByStatus(Loan.LoanStatus.GRACE_PERIOD);
        for (Loan loan : gracePeriodLoans) {
            if (loan.getGracePeriodStart() != null) {
                long daysOverdue = ChronoUnit.DAYS.between(loan.getGracePeriodStart(), LocalDateTime.now());
                if (daysOverdue < 1) daysOverdue = 1;
                double outstandingAmount = loan.getTotalRepaymentAmount() - loan.getAmountRepaid();
                double dailyRate = loan.getDailyOverdueRate() / 100.0;
                double overdueInterest = outstandingAmount * dailyRate * daysOverdue;
                loan.setOverdueInterestAccrued(overdueInterest);
                loanRepository.save(loan);
                log.info("Loan {} overdue interest updated to {} ({} days overdue)", loan.getId(), overdueInterest, daysOverdue);
            }
        }
    }

    private void checkGracePeriodExpiry() {
        List<Loan> gracePeriodLoans = loanRepository.findByStatus(Loan.LoanStatus.GRACE_PERIOD);
        for (Loan loan : gracePeriodLoans) {
            if (loan.getGracePeriodEnd() != null && loan.getGracePeriodEnd().isBefore(LocalDateTime.now())) {
                log.info("Loan {} grace period expired. Lender can now mark as defaulted.", loan.getId());
            }
        }
    }
}