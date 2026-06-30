package com.vouch.loan.service;

import com.vouch.loan.entity.Loan;
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

    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void checkOverdueLoans() {
        log.info("Running overdue loan check...");
        checkActiveLoansForOverdue();
        calculateOverdueInterest();
        checkGracePeriodExpiry();
        log.info("Overdue loan check complete.");
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
