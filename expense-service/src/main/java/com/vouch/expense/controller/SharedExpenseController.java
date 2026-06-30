package com.vouch.expense.controller;

import com.vouch.expense.dto.SharedExpenseRequest;
import com.vouch.expense.service.SharedExpenseService;
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
        return ResponseEntity.ok(Map.of("message", sharedExpenseService.settleExpenseSplit(auth.getName(), splitId)));
    }
}
