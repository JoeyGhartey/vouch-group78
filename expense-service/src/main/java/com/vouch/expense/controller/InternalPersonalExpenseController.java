package com.vouch.expense.controller;

import com.vouch.expense.dto.InternalTransactionRequest;
import com.vouch.expense.repository.ExpenseSplitRepository;
import com.vouch.expense.repository.SharedExpenseRepository;
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
    private final ExpenseSplitRepository expenseSplitRepository;
    private final SharedExpenseRepository sharedExpenseRepository;

    @PostMapping("/personal-transaction")
    public ResponseEntity<Map<String, Object>> addInternalTransaction(@Valid @RequestBody InternalTransactionRequest request) {
        return ResponseEntity.ok(personalExpenseService.addInternalTransaction(request));
    }

    // Used by loan-service before allowing a member to leave or be removed
    // from a circle -- blocks the action if they still owe, or are still owed,
    // money on a shared expense in that circle.
    @GetMapping("/circle/{circleId}/user/{userId}/has-unsettled")
    public ResponseEntity<Map<String, Object>> hasUnsettledInCircle(@PathVariable Long circleId, @PathVariable Long userId) {
        boolean hasUnsettled = !expenseSplitRepository.findUnsettledByUserAndCircle(userId, circleId).isEmpty()
                || !expenseSplitRepository.findUnsettledOwedToUserInCircle(userId, circleId).isEmpty();
        return ResponseEntity.ok(Map.of("hasUnsettled", hasUnsettled));
    }

    // Used by loan-service before allowing a circle to be deleted -- a circle
    // with any shared expense history (settled or not) isn't "empty" and
    // shouldn't be hard-deleted, to preserve that financial history.
    @GetMapping("/circle/{circleId}/has-any")
    public ResponseEntity<Map<String, Object>> circleHasAnyExpenses(@PathVariable Long circleId) {
        boolean hasAny = !sharedExpenseRepository.findByCircleId(circleId).isEmpty();
        return ResponseEntity.ok(Map.of("hasAny", hasAny));
    }
}
