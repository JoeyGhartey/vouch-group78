package com.vouch.dispute.repository;

import com.vouch.dispute.entity.Dispute;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface DisputeRepository extends JpaRepository<Dispute, Long> {
    List<Dispute> findByOpenedById(Long openedById);
    List<Dispute> findByStatus(Dispute.DisputeStatus status);
    Optional<Dispute> findByLoanId(Long loanId);
    Boolean existsByLoanIdAndStatusIn(Long loanId, List<Dispute.DisputeStatus> statuses);
}
