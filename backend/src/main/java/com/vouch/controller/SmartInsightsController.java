package com.vouch.controller;

import com.vouch.service.SmartInsightsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/insights")
@RequiredArgsConstructor
public class SmartInsightsController {

    private final SmartInsightsService smartInsightsService;

    @GetMapping("/borrower")
    public ResponseEntity<Map<String, Object>> getBorrowerInsights(Authentication auth) {
        return ResponseEntity.ok(smartInsightsService.getBorrowerInsights(auth.getName()));
    }

    @GetMapping("/lender")
    public ResponseEntity<Map<String, Object>> getLenderInsights(Authentication auth) {
        return ResponseEntity.ok(smartInsightsService.getLenderInsights(auth.getName()));
    }

    @GetMapping("/circle/{circleId}")
    public ResponseEntity<Map<String, Object>> getCircleInsights(Authentication auth, @PathVariable Long circleId) {
        return ResponseEntity.ok(smartInsightsService.getCircleInsights(auth.getName(), circleId));
    }
}
