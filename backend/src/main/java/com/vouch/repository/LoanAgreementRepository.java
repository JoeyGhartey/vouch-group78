package com.vouch.repository;

import com.vouch.entity.Loan;
import com.vouch.entity.LoanAgreement;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface LoanAgreementRepository extends JpaRepository<LoanAgreement, Long> {
    Optional<LoanAgreement> findByLoan(Loan loan);
}
