package com.vouch.expense.controller;

import com.vouch.expense.service.DebtSimplificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
public class DebtSimplificationController {

    private final DebtSimplificationService debtSimplificationService;

    @GetMapping("/shared/circle/{circleId}/simplified")
    public ResponseEntity<Map<String, Object>> getSimplifiedDebts(Authentication auth, @PathVariable Long circleId) {
        return ResponseEntity.ok(debtSimplificationService.getSimplifiedDebts(auth.getName(), circleId));
    }

    @GetMapping("/shared/circle/{circleId}/my-debts")
    public ResponseEntity<Map<String, Object>> getMyDebts(Authentication auth, @PathVariable Long circleId) {
        return ResponseEntity.ok(debtSimplificationService.getMyDebts(auth.getName(), circleId));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "running", "service", "expense-service", "version", "1.0"));
    }
}
