package com.vouch.auth.repository;

import com.vouch.auth.entity.PendingRegistration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PendingRegistrationRepository extends JpaRepository<PendingRegistration, Long> {
    Optional<PendingRegistration> findByPhone(String phone);
    Optional<PendingRegistration> findByEmail(String email);
    boolean existsByPhone(String phone);
    boolean existsByEmail(String email);
    List<PendingRegistration> findByCreatedAtBefore(LocalDateTime cutoff);
}
