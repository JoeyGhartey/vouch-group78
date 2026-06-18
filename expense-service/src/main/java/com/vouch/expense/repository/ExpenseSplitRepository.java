package com.vouch.expense.repository;

import com.vouch.expense.entity.ExpenseSplit;
import com.vouch.expense.entity.SharedExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ExpenseSplitRepository extends JpaRepository<ExpenseSplit, Long> {
    List<ExpenseSplit> findBySharedExpense(SharedExpense sharedExpense);
    List<ExpenseSplit> findByUserId(Long userId);
    List<ExpenseSplit> findByUserIdAndSettledFalse(Long userId);
}
