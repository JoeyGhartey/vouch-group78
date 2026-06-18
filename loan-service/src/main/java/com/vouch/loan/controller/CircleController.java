package com.vouch.loan.controller;

import com.vouch.loan.dto.CircleResponse;
import com.vouch.loan.dto.CreateCircleRequest;
import com.vouch.loan.dto.UpdateCircleRequest;
import com.vouch.loan.service.CircleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/circles")
@RequiredArgsConstructor
public class CircleController {

    private final CircleService circleService;

    @PostMapping
    public ResponseEntity<CircleResponse> createCircle(Authentication auth, @Valid @RequestBody CreateCircleRequest request) {
        return ResponseEntity.ok(circleService.createCircle(auth.getName(), request));
    }

    @GetMapping
    public ResponseEntity<List<CircleResponse>> getMyCircles(Authentication auth) {
        return ResponseEntity.ok(circleService.getMyCircles(auth.getName()));
    }

    @GetMapping("/{circleId}")
    public ResponseEntity<CircleResponse> getCircle(Authentication auth, @PathVariable Long circleId) {
        return ResponseEntity.ok(circleService.getCircle(auth.getName(), circleId));
    }

    @PutMapping("/{circleId}")
    public ResponseEntity<CircleResponse> updateCircle(Authentication auth, @PathVariable Long circleId, @RequestBody UpdateCircleRequest request) {
        return ResponseEntity.ok(circleService.updateCircle(auth.getName(), circleId, request));
    }

    @PostMapping("/{circleId}/invite")
    public ResponseEntity<Map<String, String>> inviteMember(Authentication auth, @PathVariable Long circleId, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(Map.of("message", circleService.inviteMember(auth.getName(), circleId, body.get("phone"))));
    }

    @PostMapping("/{circleId}/approve/{memberId}")
    public ResponseEntity<Map<String, String>> approveMember(Authentication auth, @PathVariable Long circleId, @PathVariable Long memberId) {
        return ResponseEntity.ok(Map.of("message", circleService.approveMember(auth.getName(), circleId, memberId)));
    }

    @PostMapping("/{circleId}/remove/{userId}")
    public ResponseEntity<Map<String, String>> removeMember(Authentication auth, @PathVariable Long circleId, @PathVariable Long userId) {
        return ResponseEntity.ok(Map.of("message", circleService.removeMember(auth.getName(), circleId, userId)));
    }

    @PostMapping("/{circleId}/leave")
    public ResponseEntity<Map<String, String>> leaveCircle(Authentication auth, @PathVariable Long circleId) {
        return ResponseEntity.ok(Map.of("message", circleService.leaveCircle(auth.getName(), circleId)));
    }
}
