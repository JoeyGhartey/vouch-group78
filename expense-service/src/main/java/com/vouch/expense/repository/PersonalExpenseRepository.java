package com.vouch.expense.repository;

import com.vouch.expense.entity.PersonalExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface PersonalExpenseRepository extends JpaRepository<PersonalExpense, Long> {
    List<PersonalExpense> findByUserId(Long userId);
    List<PersonalExpense> findByUserIdAndCategory(Long userId, String category);
    List<PersonalExpense> findByUserIdAndTransactionDateBetween(Long userId, LocalDateTime start, LocalDateTime end);
}
