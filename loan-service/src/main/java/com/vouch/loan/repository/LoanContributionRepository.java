package com.vouch.loan.repository;

import com.vouch.loan.entity.Loan;
import com.vouch.loan.entity.LoanContribution;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface LoanContributionRepository extends JpaRepository<LoanContribution, Long> {
    List<LoanContribution> findByLoan(Loan loan);
    Optional<LoanContribution> findByLoanAndLenderId(Loan loan, Long lenderId);
    List<LoanContribution> findByLenderId(Long lenderId);
}
