package com.vouch.repository;

import com.vouch.entity.SpendingLimit;
import com.vouch.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SpendingLimitRepository extends JpaRepository<SpendingLimit, Long> {
    List<SpendingLimit> findByUser(User user);
    Optional<SpendingLimit> findByUserAndCategory(User user, String category);
}
