package com.vouch.repository;

import com.vouch.entity.Circle;
import com.vouch.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CircleRepository extends JpaRepository<Circle, Long> {
    List<Circle> findByCreator(User creator);
}
