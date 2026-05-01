package com.vouch.repository;

import com.vouch.entity.Circle;
import com.vouch.entity.CircleMember;
import com.vouch.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CircleMemberRepository extends JpaRepository<CircleMember, Long> {
    List<CircleMember> findByUserAndStatus(User user, CircleMember.MemberStatus status);
    List<CircleMember> findByCircleAndStatus(Circle circle, CircleMember.MemberStatus status);
    Optional<CircleMember> findByCircleAndUser(Circle circle, User user);
    Boolean existsByCircleAndUser(Circle circle, User user);
}
