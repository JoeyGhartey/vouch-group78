package com.vouch.repository;

import com.vouch.entity.Dispute;
import com.vouch.entity.Loan;
import com.vouch.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface DisputeRepository extends JpaRepository<Dispute, Long> {
    List<Dispute> findByOpenedBy(User user);
    List<Dispute> findByStatus(Dispute.DisputeStatus status);
    Optional<Dispute> findByLoan(Loan loan);
    Boolean existsByLoanAndStatusIn(Loan loan, List<Dispute.DisputeStatus> statuses);
}
