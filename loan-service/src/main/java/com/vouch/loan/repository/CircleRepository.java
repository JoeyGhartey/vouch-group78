package com.vouch.loan.repository;

import com.vouch.loan.entity.Circle;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CircleRepository extends JpaRepository<Circle, Long> {
    List<Circle> findByCreatorId(Long creatorId);
}
