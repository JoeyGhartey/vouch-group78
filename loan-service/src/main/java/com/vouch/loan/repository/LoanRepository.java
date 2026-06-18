package com.vouch.loan.repository;

import com.vouch.loan.entity.Circle;
import com.vouch.loan.entity.Loan;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LoanRepository extends JpaRepository<Loan, Long> {
    List<Loan> findByBorrowerId(Long borrowerId);
    List<Loan> findByLenderId(Long lenderId);
    List<Loan> findByCircle(Circle circle);
    List<Loan> findByCircleAndStatus(Circle circle, Loan.LoanStatus status);
    List<Loan> findByBorrowerIdAndStatus(Long borrowerId, Loan.LoanStatus status);
    List<Loan> findByStatus(Loan.LoanStatus status);
}
