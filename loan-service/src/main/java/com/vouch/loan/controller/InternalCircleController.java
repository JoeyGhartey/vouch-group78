package com.vouch.loan.controller;

import com.vouch.loan.entity.Circle;
import com.vouch.loan.repository.CircleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/internal/circles")
@RequiredArgsConstructor
public class InternalCircleController {

    private final CircleRepository circleRepository;

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
}
