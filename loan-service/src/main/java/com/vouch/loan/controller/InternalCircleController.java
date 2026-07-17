package com.vouch.loan.controller;

import com.vouch.loan.entity.Circle;
import com.vouch.loan.entity.CircleMember;
import com.vouch.loan.repository.CircleMemberRepository;
import com.vouch.loan.repository.CircleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/internal/circles")
@RequiredArgsConstructor
public class InternalCircleController {

    private final CircleRepository circleRepository;
    private final CircleMemberRepository circleMemberRepository;

    @GetMapping("/{circleId}")
    public ResponseEntity<Map<String, Object>> getCircleInfo(@PathVariable Long circleId) {
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));
        Map<String, Object> result = new HashMap<>();
        result.put("id", circle.getId());
        result.put("name", circle.getName());
        result.put("creatorId", circle.getCreatorId());
        return ResponseEntity.ok(result);
    }

    // Used by other services (expense-service, dispute-service) to verify a
    // caller is actually an active member of a circle before letting them
    // read or write circle-scoped data.
    @GetMapping("/{circleId}/members/{userId}")
    public ResponseEntity<Map<String, Object>> isActiveMember(@PathVariable Long circleId, @PathVariable Long userId) {
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));
        Optional<CircleMember> member = circleMemberRepository.findByCircleAndUserId(circle, userId);
        boolean active = member.isPresent() && member.get().getStatus() == CircleMember.MemberStatus.ACTIVE;
        return ResponseEntity.ok(Map.of("active", active));
    }
}
