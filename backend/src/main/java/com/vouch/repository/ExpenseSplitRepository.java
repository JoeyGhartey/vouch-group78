package com.vouch.repository;

import com.vouch.entity.ExpenseSplit;
import com.vouch.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ExpenseSplitRepository extends JpaRepository<ExpenseSplit, Long> {
    List<ExpenseSplit> findByUserAndSettled(User user, Boolean settled);
}
