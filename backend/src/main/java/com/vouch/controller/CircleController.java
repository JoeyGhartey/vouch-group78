package com.vouch.controller;

import com.vouch.dto.CircleResponse;
import com.vouch.dto.CreateCircleRequest;
import com.vouch.service.CircleService;
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

    @PostMapping("/{circleId}/invite")
    public ResponseEntity<Map<String, String>> inviteMember(Authentication auth, @PathVariable Long circleId, @RequestBody Map<String, String> body) {
        String result = circleService.inviteMember(auth.getName(), circleId, body.get("phone"));
        return ResponseEntity.ok(Map.of("message", result));
    }

    @PostMapping("/{circleId}/approve/{memberId}")
    public ResponseEntity<Map<String, String>> approveMember(Authentication auth, @PathVariable Long circleId, @PathVariable Long memberId) {
        String result = circleService.approveMember(auth.getName(), circleId, memberId);
        return ResponseEntity.ok(Map.of("message", result));
    }

    @PostMapping("/{circleId}/remove/{userId}")
    public ResponseEntity<Map<String, String>> removeMember(Authentication auth, @PathVariable Long circleId, @PathVariable Long userId) {
        String result = circleService.removeMember(auth.getName(), circleId, userId);
        return ResponseEntity.ok(Map.of("message", result));
    }
}
