package com.vouch.controller;

import com.vouch.dto.SharedExpenseRequest;
import com.vouch.service.SharedExpenseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/expenses/shared")
@RequiredArgsConstructor
public class SharedExpenseController {

    private final SharedExpenseService sharedExpenseService;

    @PostMapping
    public ResponseEntity<Map<String, Object>> createSharedExpense(Authentication auth, @Valid @RequestBody SharedExpenseRequest request) {
        return ResponseEntity.ok(sharedExpenseService.createSharedExpense(auth.getName(), request));
    }

    @GetMapping("/circle/{circleId}")
    public ResponseEntity<List<Map<String, Object>>> getCircleExpenses(Authentication auth, @PathVariable Long circleId) {
        return ResponseEntity.ok(sharedExpenseService.getCircleExpenses(auth.getName(), circleId));
    }

    @GetMapping("/circle/{circleId}/balances")
    public ResponseEntity<Map<String, Object>> getCircleBalances(Authentication auth, @PathVariable Long circleId) {
        return ResponseEntity.ok(sharedExpenseService.getCircleBalances(auth.getName(), circleId));
    }

    @PostMapping("/settle/{splitId}")
    public ResponseEntity<Map<String, String>> settleExpense(Authentication auth, @PathVariable Long splitId) {
        String result = sharedExpenseService.settleExpenseSplit(auth.getName(), splitId);
        return ResponseEntity.ok(Map.of("message", result));
    }
}
