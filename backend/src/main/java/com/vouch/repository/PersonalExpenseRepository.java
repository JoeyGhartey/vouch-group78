package com.vouch.repository;

import com.vouch.entity.PersonalExpense;
import com.vouch.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface PersonalExpenseRepository extends JpaRepository<PersonalExpense, Long> {
    List<PersonalExpense> findByUser(User user);
    List<PersonalExpense> findByUserAndCategory(User user, String category);
    List<PersonalExpense> findByUserAndTransactionDateBetween(User user, LocalDateTime start, LocalDateTime end);
    List<PersonalExpense> findByUserAndType(User user, PersonalExpense.TransactionType type);
}
