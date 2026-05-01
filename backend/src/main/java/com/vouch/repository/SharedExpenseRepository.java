package com.vouch.repository;

import com.vouch.entity.Circle;
import com.vouch.entity.SharedExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SharedExpenseRepository extends JpaRepository<SharedExpense, Long> {
    List<SharedExpense> findByCircle(Circle circle);
    List<SharedExpense> findByCircleOrderByCreatedAtDesc(Circle circle);
}
