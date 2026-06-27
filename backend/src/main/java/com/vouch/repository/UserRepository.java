package com.vouch.repository;

import com.vouch.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByPhone(String phone);
    Optional<User> findByEmail(String email);       // NEW: for email login
    Boolean existsByPhone(String phone);
    Boolean existsByEmail(String email);            // NEW: for email duplicate check
}
