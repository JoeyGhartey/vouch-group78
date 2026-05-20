package com.vouch.service;

import com.vouch.entity.*;
import com.vouch.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class InstallmentService {

    private final LoanRepository loanRepository;
    private final LoanInstallmentRepository loanInstallmentRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    /**
     * Generate installment schedule when a flexible loan is disbursed.
     * Splits total repayment into equal monthly installments.
     */
    @Transactional
    public List<Map<String, Object>> generateInstallments(Loan loan) {
        if (loan.getRepaymentType() != Loan.RepaymentType.FLEXIBLE) {
            return Collections.emptyList();
        }

        // Check if installments already exist
        List<LoanInstallment> existing = loanInstallmentRepository.findByLoanOrderByInstallmentNumber(loan);
        if (!existing.isEmpty()) {
            return mapInstallments(existing);
        }

        int months = loan.getRepaymentPeriodMonths();
        if (months <= 0) months = 1;

        double totalRepayment = loan.getTotalRepaymentAmount();
        double monthlyAmount = Math.round(totalRepayment / months * 100.0) / 100.0;

        // Adjust last installment for rounding
        double runningTotal = 0;
        List<LoanInstallment> installments = new ArrayList<>();

        for (int i = 1; i <= months; i++) {
            double amount;
            if (i == months) {
                // Last installment gets the remainder to avoid rounding errors
                amount = Math.round((totalRepayment - runningTotal) * 100.0) / 100.0;
            } else {
                amount = monthlyAmount;
            }
            runningTotal += amount;

            LocalDateTime dueDate = loan.getDisbursedAt() != null
                    ? loan.getDisbursedAt().plusMonths(i)
                    : LocalDateTime.now().plusMonths(i);

            LoanInstallment installment = LoanInstallment.builder()
                    .loan(loan)
                    .installmentNumber(i)
                    .amountDue(amount)
                    .amountPaid(0.0)
                    .dueDate(dueDate)
                    .status(LoanInstallment.InstallmentStatus.PENDING)
                    .build();

            installments.add(installment);
        }

        loanInstallmentRepository.saveAll(installments);
        log.info("Generated {} installments for loan {}, monthly: GHS {}", months, loan.getId(), monthlyAmount);

        return mapInstallments(installments);
    }

    /**
     * Get installment schedule for a loan.
     */
    public Map<String, Object> getInstallments(String phone, Long loanId) {
        User user = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        List<LoanInstallment> installments = loanInstallmentRepository.findByLoanOrderByInstallmentNumber(loan);

        double totalPaid = installments.stream().mapToDouble(LoanInstallment::getAmountPaid).sum();
        double totalDue = installments.stream().mapToDouble(LoanInstallment::getAmountDue).sum();
        long paidCount = installments.stream().filter(i -> i.getStatus() == LoanInstallment.InstallmentStatus.PAID).count();
        long overdueCount = installments.stream().filter(i -> i.getStatus() == LoanInstallment.InstallmentStatus.OVERDUE).count();

        // Find next due installment
        Optional<LoanInstallment> nextDue = installments.stream()
                .filter(i -> i.getStatus() == LoanInstallment.InstallmentStatus.PENDING || i.getStatus() == LoanInstallment.InstallmentStatus.OVERDUE)
                .findFirst();

        Map<String, Object> response = new HashMap<>();
        response.put("loanId", loanId);
        response.put("repaymentType", loan.getRepaymentType().name());
        response.put("totalInstallments", installments.size());
        response.put("installmentsPaid", paidCount);
        response.put("installmentsOverdue", overdueCount);
        response.put("totalDue", totalDue);
        response.put("totalPaid", totalPaid);
        response.put("remaining", Math.round((totalDue - totalPaid) * 100.0) / 100.0);
        response.put("installments", mapInstallments(installments));

        if (nextDue.isPresent()) {
            Map<String, Object> next = new HashMap<>();
            next.put("installmentNumber", nextDue.get().getInstallmentNumber());
            next.put("amountDue", nextDue.get().getAmountDue());
            next.put("dueDate", nextDue.get().getDueDate());
            next.put("status", nextDue.get().getStatus().name());
            response.put("nextDue", next);
        }

        return response;
    }

    /**
     * Pay a specific installment.
     */
    @Transactional
    public Map<String, Object> payInstallment(String phone, Long loanId, Integer installmentNumber, Double amount) {
        User borrower = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (!borrower.getId().equals(loan.getBorrower().getId())) {
            throw new RuntimeException("Only the borrower can pay installments");
        }

        if (loan.getStatus() != Loan.LoanStatus.ACTIVE && loan.getStatus() != Loan.LoanStatus.DUE && loan.getStatus() != Loan.LoanStatus.GRACE_PERIOD) {
            throw new RuntimeException("Loan is not in a payable state");
        }

        List<LoanInstallment> installments = loanInstallmentRepository.findByLoanOrderByInstallmentNumber(loan);
        LoanInstallment installment = installments.stream()
                .filter(i -> i.getInstallmentNumber().equals(installmentNumber))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Installment #" + installmentNumber + " not found"));

        if (installment.getStatus() == LoanInstallment.InstallmentStatus.PAID) {
            throw new RuntimeException("Installment #" + installmentNumber + " is already paid");
        }

        double remaining = installment.getAmountDue() - installment.getAmountPaid();
        double payAmount = amount != null ? amount : remaining;

        if (payAmount <= 0) throw new RuntimeException("Amount must be positive");
        if (payAmount > remaining) throw new RuntimeException("Amount exceeds remaining: GHS " + String.format("%.2f", remaining));

        installment.setAmountPaid(Math.round((installment.getAmountPaid() + payAmount) * 100.0) / 100.0);

        if (installment.getAmountPaid() >= installment.getAmountDue()) {
            installment.setStatus(LoanInstallment.InstallmentStatus.PAID);
            installment.setPaidAt(LocalDateTime.now());
        } else {
            installment.setStatus(LoanInstallment.InstallmentStatus.PARTIALLY_PAID);
        }

        loanInstallmentRepository.save(installment);

        // Update loan's total amount repaid
        loan.setAmountRepaid(Math.round((loan.getAmountRepaid() + payAmount) * 100.0) / 100.0);

        // Check if all installments are paid
        boolean allPaid = installments.stream()
                .allMatch(i -> i.getStatus() == LoanInstallment.InstallmentStatus.PAID ||
                        (i.getInstallmentNumber().equals(installmentNumber) && installment.getAmountPaid() >= installment.getAmountDue()));

        if (allPaid && loan.getAmountRepaid() >= loan.getTotalRepaymentAmount()) {
            loan.setStatus(Loan.LoanStatus.REPAID);
            loan.setCompletedAt(LocalDateTime.now());

            if (loan.getLender() != null) {
                notificationService.send(loan.getLender(), "Loan Fully Repaid",
                        loan.getBorrower().getFirstName() + " has completed all installments for GHS " + loan.getAmount(),
                        Notification.NotificationType.LOAN_REPAID, loan.getId());
            }
            notificationService.send(loan.getBorrower(), "Loan Fully Repaid",
                    "Congratulations! You've completed all installments for your GHS " + loan.getAmount() + " loan.",
                    Notification.NotificationType.LOAN_REPAID, loan.getId());
        } else if (loan.getLender() != null) {
            notificationService.send(loan.getLender(), "Installment Payment",
                    loan.getBorrower().getFirstName() + " paid GHS " + String.format("%.2f", payAmount) + " for installment #" + installmentNumber,
                    Notification.NotificationType.LOAN_REPAID, loan.getId());
        }

        loanRepository.save(loan);

        Map<String, Object> response = new HashMap<>();
        response.put("installmentNumber", installmentNumber);
        response.put("amountPaid", payAmount);
        response.put("installmentStatus", installment.getStatus().name());
        response.put("loanStatus", loan.getStatus().name());
        response.put("totalRepaid", loan.getAmountRepaid());
        response.put("totalRemaining", Math.round((loan.getTotalRepaymentAmount() - loan.getAmountRepaid()) * 100.0) / 100.0);
        response.put("message", allPaid ? "All installments paid. Loan fully repaid!" : "Installment payment recorded.");
        return response;
    }

    /**
     * Check for overdue installments — called by the scheduler.
     */
    @Transactional
    public void checkOverdueInstallments() {
        List<Loan> activeLoans = loanRepository.findByStatus(Loan.LoanStatus.ACTIVE);
        activeLoans.addAll(loanRepository.findByStatus(Loan.LoanStatus.DUE));

        for (Loan loan : activeLoans) {
            if (loan.getRepaymentType() != Loan.RepaymentType.FLEXIBLE) continue;

            List<LoanInstallment> installments = loanInstallmentRepository.findByLoanOrderByInstallmentNumber(loan);
            for (LoanInstallment installment : installments) {
                if (installment.getStatus() == LoanInstallment.InstallmentStatus.PENDING &&
                    installment.getDueDate().isBefore(LocalDateTime.now())) {

                    installment.setStatus(LoanInstallment.InstallmentStatus.OVERDUE);
                    loanInstallmentRepository.save(installment);

                    notificationService.send(loan.getBorrower(), "Installment Overdue",
                            "Installment #" + installment.getInstallmentNumber() + " of GHS " +
                            String.format("%.2f", installment.getAmountDue()) + " is overdue.",
                            Notification.NotificationType.LOAN_OVERDUE, loan.getId());

                    log.info("Installment #{} for loan {} marked as overdue", installment.getInstallmentNumber(), loan.getId());
                }
            }
        }
    }

    private List<Map<String, Object>> mapInstallments(List<LoanInstallment> installments) {
        return installments.stream().map(i -> {
            Map<String, Object> map = new HashMap<>();
            map.put("installmentNumber", i.getInstallmentNumber());
            map.put("amountDue", i.getAmountDue());
            map.put("amountPaid", i.getAmountPaid());
            map.put("remaining", Math.round((i.getAmountDue() - i.getAmountPaid()) * 100.0) / 100.0);
            map.put("dueDate", i.getDueDate());
            map.put("status", i.getStatus().name());
            map.put("paidAt", i.getPaidAt());
            return map;
        }).collect(Collectors.toList());
    }

    private User getUserByPhone(String phone) {
        return userRepository.findByPhone(phone).orElseThrow(() -> new RuntimeException("User not found"));
    }
}
