package com.vouch.loan.repository;

import com.vouch.loan.entity.Loan;
import com.vouch.loan.entity.LoanAgreement;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface LoanAgreementRepository extends JpaRepository<LoanAgreement, Long> {
    Optional<LoanAgreement> findByLoan(Loan loan);
}
