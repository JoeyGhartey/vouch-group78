package com.vouch.repository;

import com.vouch.entity.Loan;
import com.vouch.entity.LoanContribution;
import com.vouch.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface LoanContributionRepository extends JpaRepository<LoanContribution, Long> {
    List<LoanContribution> findByLoan(Loan loan);
    Optional<LoanContribution> findByLoanAndLender(Loan loan, User lender);
    List<LoanContribution> findByLender(User lender);
}