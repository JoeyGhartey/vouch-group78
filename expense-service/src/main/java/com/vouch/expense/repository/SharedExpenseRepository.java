package com.vouch.expense.repository;

import com.vouch.expense.entity.SharedExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SharedExpenseRepository extends JpaRepository<SharedExpense, Long> {
    List<SharedExpense> findByCircleId(Long circleId);
    List<SharedExpense> findByCircleIdOrderByCreatedAtDesc(Long circleId);
}
