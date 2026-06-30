package com.vouch.loan.repository;

import com.vouch.loan.entity.Loan;
import com.vouch.loan.entity.LoanInstallment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LoanInstallmentRepository extends JpaRepository<LoanInstallment, Long> {
    List<LoanInstallment> findByLoanOrderByInstallmentNumber(Loan loan);
    List<LoanInstallment> findByLoanAndStatus(Loan loan, LoanInstallment.InstallmentStatus status);
}
