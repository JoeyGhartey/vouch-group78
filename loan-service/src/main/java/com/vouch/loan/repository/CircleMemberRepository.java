package com.vouch.loan.repository;

import com.vouch.loan.entity.Circle;
import com.vouch.loan.entity.CircleMember;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CircleMemberRepository extends JpaRepository<CircleMember, Long> {
    List<CircleMember> findByUserIdAndStatus(Long userId, CircleMember.MemberStatus status);
    List<CircleMember> findByCircleAndStatus(Circle circle, CircleMember.MemberStatus status);
    Optional<CircleMember> findByCircleAndUserId(Circle circle, Long userId);
    Boolean existsByCircleAndUserId(Circle circle, Long userId);
}
