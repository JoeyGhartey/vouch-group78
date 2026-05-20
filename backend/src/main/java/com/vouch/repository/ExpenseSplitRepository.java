package com.vouch.repository;

import com.vouch.entity.ExpenseSplit;
import com.vouch.entity.SharedExpense;
import com.vouch.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ExpenseSplitRepository extends JpaRepository<ExpenseSplit, Long> {
    List<ExpenseSplit> findBySharedExpense(SharedExpense sharedExpense);
    List<ExpenseSplit> findByUser(User user);
    List<ExpenseSplit> findByUserAndSettledFalse(User user);
}