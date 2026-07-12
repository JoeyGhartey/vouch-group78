package com.vouch.expense.controller;

import com.vouch.expense.dto.InternalTransactionRequest;
import com.vouch.expense.service.PersonalExpenseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/expenses/internal")
@RequiredArgsConstructor
public class InternalPersonalExpenseController {

    private final PersonalExpenseService personalExpenseService;

    @PostMapping("/personal-transaction")
    public ResponseEntity<Map<String, Object>> addInternalTransaction(@Valid @RequestBody InternalTransactionRequest request) {
        return ResponseEntity.ok(personalExpenseService.addInternalTransaction(request));
    }
}
