package com.vouch.repository;

import com.vouch.entity.Circle;
import com.vouch.entity.Loan;
import com.vouch.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LoanRepository extends JpaRepository<Loan, Long> {
    List<Loan> findByBorrower(User borrower);
    List<Loan> findByLender(User lender);
    List<Loan> findByCircle(Circle circle);
    List<Loan> findByCircleAndStatus(Circle circle, Loan.LoanStatus status);
    List<Loan> findByBorrowerAndStatus(User borrower, Loan.LoanStatus status);
    List<Loan> findByStatus(Loan.LoanStatus status);
}
