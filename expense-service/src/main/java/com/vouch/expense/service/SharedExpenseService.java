package com.vouch.expense.service;

import com.vouch.expense.dto.SharedExpenseRequest;
import com.vouch.expense.entity.ExpenseSplit;
import com.vouch.expense.entity.SharedExpense;
import com.vouch.expense.repository.ExpenseSplitRepository;
import com.vouch.expense.repository.SharedExpenseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SharedExpenseService {

    private final SharedExpenseRepository sharedExpenseRepository;
    private final ExpenseSplitRepository expenseSplitRepository;
    private final AuthServiceClient authServiceClient;
    private final NotificationServiceClient notificationServiceClient;

    @Transactional
    public Map<String, Object> createSharedExpense(String phone, SharedExpenseRequest request) {
        Long paidById = authServiceClient.getUserIdByPhone(phone);

        SharedExpense expense = SharedExpense.builder()
                .circleId(request.getCircleId()).paidById(paidById)
                .description(request.getDescription()).totalAmount(request.getTotalAmount())
                .category(request.getCategory()).build();
        expense = sharedExpenseRepository.save(expense);

        List<Long> participantIds = new ArrayList<>(request.getParticipantIds());
        if (!participantIds.contains(paidById)) participantIds.add(paidById);

        List<ExpenseSplit> splits = new ArrayList<>();
        if (request.getCustomSplits() != null && !request.getCustomSplits().isEmpty()) {
            for (Map.Entry<Long, Double> entry : request.getCustomSplits().entrySet()) {
                splits.add(ExpenseSplit.builder().sharedExpense(expense).userId(entry.getKey())
                        .amountOwed(entry.getValue()).settled(entry.getKey().equals(paidById)).build());
            }
        } else {
            double splitAmount = request.getTotalAmount() / participantIds.size();
            for (Long pid : participantIds) {
                splits.add(ExpenseSplit.builder().sharedExpense(expense).userId(pid)
                        .amountOwed(splitAmount).settled(pid.equals(paidById)).build());
            }
        }
        expenseSplitRepository.saveAll(splits);

        String payerName = authServiceClient.getUserName(paidById);
        for (Long pid : participantIds) {
            if (!pid.equals(paidById)) {
                notificationServiceClient.send(pid, "Shared Expense",
                        payerName + " added a shared expense: " + request.getDescription() + " (GHS " + request.getTotalAmount() + ")",
                        "SHARED_EXPENSE_CREATED", expense.getId());
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("expenseId", expense.getId()); response.put("description", expense.getDescription());
        response.put("totalAmount", expense.getTotalAmount()); response.put("paidBy", payerName);
        response.put("splits", splits.stream().map(s -> {
            Map<String, Object> sm = new HashMap<>();
            sm.put("userId", s.getUserId()); sm.put("name", authServiceClient.getUserName(s.getUserId()));
            sm.put("amountOwed", s.getAmountOwed()); sm.put("settled", s.getSettled()); return sm;
        }).collect(Collectors.toList()));
        response.put("message", "Shared expense created successfully");
        return response;
    }

    public List<Map<String, Object>> getCircleExpenses(String phone, Long circleId) {
        authServiceClient.getUserIdByPhone(phone);
        return sharedExpenseRepository.findByCircleIdOrderByCreatedAtDesc(circleId).stream().map(expense -> {
            Map<String, Object> map = new HashMap<>();
            map.put("expenseId", expense.getId()); map.put("description", expense.getDescription());
            map.put("totalAmount", expense.getTotalAmount()); map.put("category", expense.getCategory());
            map.put("paidBy", authServiceClient.getUserName(expense.getPaidById())); map.put("createdAt", expense.getCreatedAt());
            return map;
        }).collect(Collectors.toList());
    }

    public Map<String, Object> getCircleBalances(String phone, Long circleId) {
        authServiceClient.getUserIdByPhone(phone);
        List<SharedExpense> expenses = sharedExpenseRepository.findByCircleId(circleId);
        Map<String, Double> balances = new HashMap<>();

        for (SharedExpense expense : expenses) {
            String payerName = authServiceClient.getUserName(expense.getPaidById());
            for (ExpenseSplit split : expense.getSplits()) {
                if (!split.getSettled() && !split.getUserId().equals(expense.getPaidById())) {
                    String owerName = authServiceClient.getUserName(split.getUserId());
                    String key = owerName + " → " + payerName;
                    balances.merge(key, split.getAmountOwed(), Double::sum);
                }
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("circleId", circleId); response.put("balances", balances);
        return response;
    }

    @Transactional
    public String settleExpenseSplit(String phone, Long splitId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        ExpenseSplit split = expenseSplitRepository.findById(splitId).orElseThrow(() -> new RuntimeException("Split not found"));
        if (!userId.equals(split.getUserId())) throw new RuntimeException("You can only settle your own splits");
        split.setSettled(true); split.setSettledAt(LocalDateTime.now());
        expenseSplitRepository.save(split);

        SharedExpense expense = split.getSharedExpense();
        notificationServiceClient.send(expense.getPaidById(), "Expense Settled",
                authServiceClient.getUserName(userId) + " settled GHS " + split.getAmountOwed() + " for \"" + expense.getDescription() + "\"",
                "SHARED_EXPENSE_SETTLED", expense.getId());
        return "Split settled successfully";
    }
}
