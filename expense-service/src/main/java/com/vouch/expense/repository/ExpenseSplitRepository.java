package com.vouch.expense.repository;

import com.vouch.expense.entity.ExpenseSplit;
import com.vouch.expense.entity.SharedExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface ExpenseSplitRepository extends JpaRepository<ExpenseSplit, Long> {
    List<ExpenseSplit> findBySharedExpense(SharedExpense sharedExpense);
    List<ExpenseSplit> findByUserId(Long userId);
    List<ExpenseSplit> findByUserIdAndSettledFalse(Long userId);

    // Splits this user still owes, within a specific circle -- used to block
    // leaving/removing a member who still owes money on a shared expense.
    @Query("select s from ExpenseSplit s where s.userId = :userId and s.settled = false " +
            "and s.sharedExpense.circleId = :circleId")
    List<ExpenseSplit> findUnsettledByUserAndCircle(@Param("userId") Long userId, @Param("circleId") Long circleId);

    // Splits still owed TO this user (they paid, someone else hasn't settled up),
    // within a specific circle -- same use case, other direction.
    @Query("select s from ExpenseSplit s where s.sharedExpense.paidById = :userId and s.settled = false " +
            "and s.sharedExpense.circleId = :circleId and s.userId <> :userId")
    List<ExpenseSplit> findUnsettledOwedToUserInCircle(@Param("userId") Long userId, @Param("circleId") Long circleId);
}
