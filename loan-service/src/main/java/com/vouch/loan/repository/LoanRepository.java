package com.vouch.loan.repository;

import com.vouch.loan.entity.Circle;
import com.vouch.loan.entity.Loan;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface LoanRepository extends JpaRepository<Loan, Long> {
    List<Loan> findByBorrowerIdOrderByCreatedAtDesc(Long borrowerId);
    List<Loan> findByLenderIdOrderByCreatedAtDesc(Long lenderId);
    List<Loan> findByCircle(Circle circle);
    List<Loan> findByCircleAndStatus(Circle circle, Loan.LoanStatus status);
    List<Loan> findByBorrowerIdAndStatus(Long borrowerId, Loan.LoanStatus status);
    List<Loan> findByStatus(Loan.LoanStatus status);

    // Takes a DB-level row lock (SELECT ... FOR UPDATE) for the duration of the
    // enclosing transaction. Use this instead of findById in any method that reads
    // a loan's status and then mutates it — otherwise two concurrent requests (e.g.
    // two lenders funding the same loan, or a double-tapped "Repay" button) can both
    // pass the status check before either one commits, corrupting loan state.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from Loan l where l.id = :id")
    Optional<Loan> findByIdForUpdate(@Param("id") Long id);
}
