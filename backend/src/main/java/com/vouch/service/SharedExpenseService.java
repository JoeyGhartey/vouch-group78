package com.vouch.service;

import com.vouch.dto.SharedExpenseRequest;
import com.vouch.entity.*;
import com.vouch.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SharedExpenseService {

    private final SharedExpenseRepository sharedExpenseRepository;
    private final ExpenseSplitRepository expenseSplitRepository;
    private final CircleRepository circleRepository;
    private final UserRepository userRepository;
    private final CircleService circleService;

    @Transactional
    public Map<String, Object> createSharedExpense(String phone, SharedExpenseRequest request) {
        User paidBy = getUserByPhone(phone);
        Circle circle = circleRepository.findById(request.getCircleId())
                .orElseThrow(() -> new RuntimeException("Circle not found"));

        circleService.validateMembership(circle, paidBy);

        SharedExpense expense = SharedExpense.builder()
                .circle(circle)
                .paidBy(paidBy)
                .description(request.getDescription())
                .totalAmount(request.getTotalAmount())
                .category(request.getCategory())
                .build();

        expense = sharedExpenseRepository.save(expense);

        List<User> participants = new ArrayList<>();
        for (Long userId : request.getParticipantIds()) {
            User participant = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userId));
            circleService.validateMembership(circle, participant);
            participants.add(participant);
        }

        if (!request.getParticipantIds().contains(paidBy.getId())) {
            participants.add(paidBy);
        }

        List<ExpenseSplit> splits = new ArrayList<>();
        if (request.getCustomSplits() != null && !request.getCustomSplits().isEmpty()) {
            for (Map.Entry<Long, Double> entry : request.getCustomSplits().entrySet()) {
                User participant = userRepository.findById(entry.getKey())
                        .orElseThrow(() -> new RuntimeException("User not found: " + entry.getKey()));

                ExpenseSplit split = ExpenseSplit.builder()
                        .sharedExpense(expense)
                        .user(participant)
                        .amountOwed(entry.getValue())
                        .settled(participant.getId().equals(paidBy.getId()))
                        .build();
                splits.add(split);
            }
        } else {
            double splitAmount = request.getTotalAmount() / participants.size();
            for (User participant : participants) {
                ExpenseSplit split = ExpenseSplit.builder()
                        .sharedExpense(expense)
                        .user(participant)
                        .amountOwed(splitAmount)
                        .settled(participant.getId().equals(paidBy.getId()))
                        .build();
                splits.add(split);
            }
        }

        expenseSplitRepository.saveAll(splits);

        Map<String, Object> response = new HashMap<>();
        response.put("expenseId", expense.getId());
        response.put("description", expense.getDescription());
        response.put("totalAmount", expense.getTotalAmount());
        response.put("paidBy", paidBy.getFirstName() + " " + paidBy.getLastName());
        response.put("splits", splits.stream().map(s -> {
            Map<String, Object> splitMap = new HashMap<>();
            splitMap.put("userId", s.getUser().getId());
            splitMap.put("name", s.getUser().getFirstName() + " " + s.getUser().getLastName());
            splitMap.put("amountOwed", s.getAmountOwed());
            splitMap.put("settled", s.getSettled());
            return splitMap;
        }).collect(Collectors.toList()));
        response.put("message", "Shared expense created successfully");

        return response;
    }

    public List<Map<String, Object>> getCircleExpenses(String phone, Long circleId) {
        User user = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));

        circleService.validateMembership(circle, user);

        return sharedExpenseRepository.findByCircleOrderByCreatedAtDesc(circle).stream()
                .map(expense -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("expenseId", expense.getId());
                    map.put("description", expense.getDescription());
                    map.put("totalAmount", expense.getTotalAmount());
                    map.put("category", expense.getCategory());
                    map.put("paidBy", expense.getPaidBy().getFirstName() + " " + expense.getPaidBy().getLastName());
                    map.put("createdAt", expense.getCreatedAt());
                    return map;
                }).collect(Collectors.toList());
    }

    public Map<String, Object> getCircleBalances(String phone, Long circleId) {
        User user = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));

        circleService.validateMembership(circle, user);

        List<SharedExpense> expenses = sharedExpenseRepository.findByCircle(circle);
        Map<String, Double> balances = new HashMap<>();

        for (SharedExpense expense : expenses) {
            String payerKey = expense.getPaidBy().getFirstName() + " " + expense.getPaidBy().getLastName();

            for (ExpenseSplit split : expense.getSplits()) {
                if (!split.getSettled() && !split.getUser().getId().equals(expense.getPaidBy().getId())) {
                    String owerKey = split.getUser().getFirstName() + " " + split.getUser().getLastName();
                    String balanceKey = owerKey + " → " + payerKey;
                    balances.merge(balanceKey, split.getAmountOwed(), Double::sum);
                }
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("circleId", circleId);
        response.put("circleName", circle.getName());
        response.put("balances", balances);
        return response;
    }

    @Transactional
    public String settleExpenseSplit(String phone, Long splitId) {
        User user = getUserByPhone(phone);
        ExpenseSplit split = expenseSplitRepository.findById(splitId)
                .orElseThrow(() -> new RuntimeException("Split not found"));

        if (!user.getId().equals(split.getUser().getId())) {
            throw new RuntimeException("You can only settle your own splits");
        }

        split.setSettled(true);
        split.setSettledAt(java.time.LocalDateTime.now());
        expenseSplitRepository.save(split);

        return "Split settled successfully";
    }

    private User getUserByPhone(String phone) {
        return userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
