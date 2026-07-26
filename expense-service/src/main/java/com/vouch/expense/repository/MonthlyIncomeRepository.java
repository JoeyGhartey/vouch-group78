package com.vouch.expense.repository;

import com.vouch.expense.entity.MonthlyIncome;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface MonthlyIncomeRepository extends JpaRepository<MonthlyIncome, Long> {
    Optional<MonthlyIncome> findByUserId(Long userId);
}
