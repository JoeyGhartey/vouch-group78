package com.vouch.controller;

import com.vouch.service.DebtSimplificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/expenses/shared")
@RequiredArgsConstructor
public class DebtSimplificationController {

    private final DebtSimplificationService debtSimplificationService;

    /**
     * Get simplified debts for a circle.
     * Shows original transactions vs simplified (minimum number of payments).
     */
    @GetMapping("/circle/{circleId}/simplified")
    public ResponseEntity<Map<String, Object>> getSimplifiedDebts(
            Authentication auth,
            @PathVariable Long circleId) {
        return ResponseEntity.ok(debtSimplificationService.getSimplifiedDebts(auth.getName(), circleId));
    }

    /**
     * Get what the current user owes or is owed in a circle.
     */
    @GetMapping("/circle/{circleId}/my-debts")
    public ResponseEntity<Map<String, Object>> getMyDebts(
            Authentication auth,
            @PathVariable Long circleId) {
        return ResponseEntity.ok(debtSimplificationService.getMyDebts(auth.getName(), circleId));
    }
}
