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
    private final LoanOverdueProcessor loanOverdueProcessor;

    // Not @Transactional at this level on purpose -- each loan below is now
    // processed in its own short, separately-locked transaction via
    // LoanOverdueProcessor instead of one long-lived batch transaction. See the
    // comment on LoanOverdueProcessor for why that matters.
    @Scheduled(fixedRate = 3600000)
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

                String title = "Gentle Nudge";
                String message = borrowerName + "'s loan of GHS "
                        + String.format("%.0f", loan.getAmount())
                        + " is due " + timeLeft
                        + ". Let's support them!";

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
        for (Long loanId : loanOverdueProcessor.findLoanIdsByStatus(Loan.LoanStatus.ACTIVE)) {
            try {
                loanOverdueProcessor.processActiveToDue(loanId);
            } catch (Exception e) {
                log.warn("Failed ACTIVE->DUE check for loan {}: {}", loanId, e.getMessage());
            }
        }

        for (Long loanId : loanOverdueProcessor.findLoanIdsByStatus(Loan.LoanStatus.DUE)) {
            try {
                loanOverdueProcessor.processDueToGracePeriod(loanId);
            } catch (Exception e) {
                log.warn("Failed DUE->GRACE_PERIOD check for loan {}: {}", loanId, e.getMessage());
            }
        }
    }

    private void calculateOverdueInterest() {
        for (Long loanId : loanOverdueProcessor.findLoanIdsByStatus(Loan.LoanStatus.GRACE_PERIOD)) {
            try {
                loanOverdueProcessor.processOverdueInterest(loanId);
            } catch (Exception e) {
                log.warn("Failed overdue interest calc for loan {}: {}", loanId, e.getMessage());
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