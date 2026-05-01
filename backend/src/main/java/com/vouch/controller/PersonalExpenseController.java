package com.vouch.controller;

import com.vouch.dto.PersonalExpenseRequest;
import com.vouch.service.PersonalExpenseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/expenses/personal")
@RequiredArgsConstructor
public class PersonalExpenseController {

    private final PersonalExpenseService personalExpenseService;

    @PostMapping
    public ResponseEntity<Map<String, Object>> addExpense(Authentication auth, @Valid @RequestBody PersonalExpenseRequest request) {
        return ResponseEntity.ok(personalExpenseService.addExpense(auth.getName(), request));
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getTransactions(Authentication auth) {
        return ResponseEntity.ok(personalExpenseService.getTransactions(auth.getName()));
    }

    @GetMapping("/summary/{year}/{month}")
    public ResponseEntity<Map<String, Object>> getMonthlySummary(Authentication auth, @PathVariable int year, @PathVariable int month) {
        return ResponseEntity.ok(personalExpenseService.getMonthlySummary(auth.getName(), year, month));
    }
}
