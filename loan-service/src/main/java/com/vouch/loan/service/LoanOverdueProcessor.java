package com.vouch.loan.service;

import com.vouch.loan.entity.CircleMember;
import com.vouch.loan.entity.Loan;
import com.vouch.loan.repository.CircleMemberRepository;
import com.vouch.loan.repository.LoanRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

// Split out from LoanSchedulerService so each loan is processed in its own
// short-lived, separately-committed transaction using the same row-level lock
// (findByIdForUpdate) that every user-initiated loan mutation uses. Before this,
// the scheduler loaded a whole batch of loans via a plain, unlocked findByStatus
// inside one long-lived transaction and saved them at the end -- if a user action
// (repay/cancel/default) committed against the same loan while the scheduler's
// batch was still open, the scheduler's later save() would silently overwrite it
// with its stale in-memory copy. Processing one locked loan per transaction here
// closes that window: this now contends for the same lock instead of racing past it.
@Service
@RequiredArgsConstructor
@Slf4j
public class LoanOverdueProcessor {

    private final LoanRepository loanRepository;
    private final CircleMemberRepository circleMemberRepository;
    private final NotificationServiceClient notificationServiceClient;
    private final AuthServiceClient authServiceClient;

    @Transactional
    public void processActiveToDue(Long loanId) {
        Loan loan = loanRepository.findByIdForUpdate(loanId).orElse(null);
        if (loan == null || loan.getStatus() != Loan.LoanStatus.ACTIVE) return;

        if (loan.getDueDate() != null && loan.getDueDate().isBefore(LocalDateTime.now())) {
            loan.setStatus(Loan.LoanStatus.DUE);
            loanRepository.save(loan);
            log.info("Loan {} marked as DUE", loan.getId());
        }
    }

    @Transactional
    public void processDueToGracePeriod(Long loanId) {
        Loan loan = loanRepository.findByIdForUpdate(loanId).orElse(null);
        if (loan == null || loan.getStatus() != Loan.LoanStatus.DUE) return;

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

    @Transactional
    public void processOverdueInterest(Long loanId) {
        Loan loan = loanRepository.findByIdForUpdate(loanId).orElse(null);
        if (loan == null || loan.getStatus() != Loan.LoanStatus.GRACE_PERIOD) return;

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

    public List<Long> findLoanIdsByStatus(Loan.LoanStatus status) {
        return loanRepository.findByStatus(status).stream().map(Loan::getId).toList();
    }
}
