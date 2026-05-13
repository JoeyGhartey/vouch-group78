package com.vouch.repository;

import com.vouch.entity.Loan;
import com.vouch.entity.LoanInstallment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LoanInstallmentRepository extends JpaRepository<LoanInstallment, Long> {
    List<LoanInstallment> findByLoanOrderByInstallmentNumber(Loan loan);
    List<LoanInstallment> findByLoanAndStatus(Loan loan, LoanInstallment.InstallmentStatus status);
}
