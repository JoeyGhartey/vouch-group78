package com.vouch.expense.repository;

import com.vouch.expense.entity.SpendingLimit;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SpendingLimitRepository extends JpaRepository<SpendingLimit, Long> {
    List<SpendingLimit> findByUserId(Long userId);
    Optional<SpendingLimit> findByUserIdAndCategory(Long userId, String category);
}
