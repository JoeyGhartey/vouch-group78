package com.vouch.expense.service;

import com.vouch.expense.dto.SharedExpenseRequest;
import com.vouch.expense.dto.InternalTransactionRequest;
import com.vouch.expense.entity.ExpenseSplit;
import com.vouch.expense.entity.SharedExpense;
import com.vouch.expense.repository.ExpenseSplitRepository;
import com.vouch.expense.repository.SharedExpenseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SharedExpenseService {

    private final SharedExpenseRepository sharedExpenseRepository;
    private final ExpenseSplitRepository expenseSplitRepository;
    private final AuthServiceClient authServiceClient;
    private final NotificationServiceClient notificationServiceClient;
    private final PersonalExpenseService personalExpenseService;

    @Transactional
    public Map<String, Object> createSharedExpense(String phone, SharedExpenseRequest request) {
        Long paidById = authServiceClient.getUserIdByPhone(phone);
        boolean payerAlreadyPaid = request.getPayerAlreadyPaid() == null || request.getPayerAlreadyPaid();

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
                        .amountOwed(entry.getValue()).settled(entry.getKey().equals(paidById) && payerAlreadyPaid).build());
            }
        } else {
            double splitAmount = request.getTotalAmount() / participantIds.size();
            for (Long pid : participantIds) {
                splits.add(ExpenseSplit.builder().sharedExpense(expense).userId(pid)
                        .amountOwed(splitAmount).settled(pid.equals(paidById) && payerAlreadyPaid).build());
            }
        }
        expenseSplitRepository.saveAll(splits);

        Set<Long> memberIds = new HashSet<>(participantIds);
        for (ExpenseSplit s : splits) {
            memberIds.add(s.getUserId());
        }
        Map<Long, Map<String, Object>> members = authServiceClient.getUsersInfo(memberIds);
        String payerName = AuthServiceClient.nameOf(members.get(paidById));
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
            sm.put("userId", s.getUserId()); sm.put("name", AuthServiceClient.nameOf(members.get(s.getUserId())));
            sm.put("amountOwed", s.getAmountOwed()); sm.put("settled", s.getSettled()); return sm;
        }).collect(Collectors.toList()));
        response.put("message", "Shared expense created successfully");
        return response;
    }

    public List<Map<String, Object>> getCircleExpenses(String phone, Long circleId) {
        authServiceClient.getUserIdByPhone(phone);
        List<SharedExpense> expenses = sharedExpenseRepository.findByCircleIdOrderByCreatedAtDesc(circleId);
        Set<Long> payerIds = new HashSet<>();
        for (SharedExpense expense : expenses) {
            payerIds.add(expense.getPaidById());
        }
        Map<Long, Map<String, Object>> payers = authServiceClient.getUsersInfo(payerIds);
        return expenses.stream().map(expense -> {
            Map<String, Object> map = new HashMap<>();
            map.put("expenseId", expense.getId()); map.put("description", expense.getDescription());
            map.put("totalAmount", expense.getTotalAmount()); map.put("category", expense.getCategory());
            map.put("paidBy", AuthServiceClient.nameOf(payers.get(expense.getPaidById())));
            map.put("paidById", expense.getPaidById());
            map.put("createdAt", expense.getCreatedAt());
            map.put("splits", expense.getSplits().stream().map(s -> {
                Map<String, Object> sm = new HashMap<>();
                sm.put("id", s.getId());
                sm.put("userId", s.getUserId());
                sm.put("amountOwed", s.getAmountOwed());
                sm.put("settled", s.getSettled());
                sm.put("paymentRequested", s.getPaymentRequested());
                return sm;
            }).collect(Collectors.toList()));
            return map;
        }).collect(Collectors.toList());
    }

    public Map<String, Object> getCircleBalances(String phone, Long circleId) {
        authServiceClient.getUserIdByPhone(phone);
        List<SharedExpense> expenses = sharedExpenseRepository.findByCircleId(circleId);
        Map<String, Double> balances = new HashMap<>();

        Set<Long> userIds = new HashSet<>();
        for (SharedExpense expense : expenses) {
            userIds.add(expense.getPaidById());
            for (ExpenseSplit split : expense.getSplits()) {
                if (!split.getSettled() && !split.getUserId().equals(expense.getPaidById())) {
                    userIds.add(split.getUserId());
                }
            }
        }
        Map<Long, Map<String, Object>> users = authServiceClient.getUsersInfo(userIds);

        for (SharedExpense expense : expenses) {
            String payerName = AuthServiceClient.nameOf(users.get(expense.getPaidById()));
            for (ExpenseSplit split : expense.getSplits()) {
                if (!split.getSettled() && !split.getUserId().equals(expense.getPaidById())) {
                    String owerName = AuthServiceClient.nameOf(users.get(split.getUserId()));
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
        SharedExpense expense = split.getSharedExpense();
        if (!userId.equals(expense.getPaidById())) throw new RuntimeException("Only the person who paid can settle this split");
        split.setSettled(true); split.setSettledAt(LocalDateTime.now());
        expenseSplitRepository.save(split);

        notificationServiceClient.send(split.getUserId(), "Expense Settled",
                "Your payment of GHS " + split.getAmountOwed() + " for \"" + expense.getDescription() + "\" was marked settled",
                "SHARED_EXPENSE_SETTLED", expense.getId());
        return "Split settled successfully";
    }

    @Transactional
    public String requestPayment(String phone, Long splitId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        ExpenseSplit split = expenseSplitRepository.findById(splitId).orElseThrow(() -> new RuntimeException("Split not found"));
        if (!userId.equals(split.getUserId())) throw new RuntimeException("You can only request payment confirmation for your own splits");
        split.setPaymentRequested(true); split.setPaymentRequestedAt(LocalDateTime.now());
        expenseSplitRepository.save(split);

        SharedExpense expense = split.getSharedExpense();
        notificationServiceClient.send(expense.getPaidById(), "Payment Requested",
                authServiceClient.getUserName(userId) + " says they paid GHS " + split.getAmountOwed() + " for \"" + expense.getDescription() + "\". Please confirm.",
                "SHARED_EXPENSE_SETTLED", expense.getId());
        return "Payment request sent. Waiting for confirmation.";
    }

    @Transactional
    public String confirmPayment(String phone, Long splitId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        ExpenseSplit split = expenseSplitRepository.findById(splitId).orElseThrow(() -> new RuntimeException("Split not found"));
        SharedExpense expense = split.getSharedExpense();
        if (!userId.equals(expense.getPaidById())) throw new RuntimeException("Only the person who paid can confirm this payment");
        split.setSettled(true); split.setSettledAt(LocalDateTime.now());
        expenseSplitRepository.save(split);

        try {
            personalExpenseService.addInternalTransaction(new InternalTransactionRequest(
                    split.getUserId(), "Paid share - " + expense.getDescription(), split.getAmountOwed(), "Shared Expense", "EXPENSE"));
            personalExpenseService.addInternalTransaction(new InternalTransactionRequest(
                    expense.getPaidById(), "Received share - " + expense.getDescription(), split.getAmountOwed(), "Shared Expense", "INCOME"));
        } catch (Exception e) {
            log.warn("Failed to log personal transactions for split {}: {}", splitId, e.getMessage());
        }

        return "Payment confirmed. Split settled.";
    }

    @Transactional
    public String deleteSharedExpense(String phone, Long expenseId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        SharedExpense expense = sharedExpenseRepository.findById(expenseId).orElseThrow(() -> new RuntimeException("Expense not found"));
        if (!userId.equals(expense.getPaidById())) throw new RuntimeException("Only the person who created this expense can delete it");
        sharedExpenseRepository.delete(expense);
        return "Shared expense deleted";
    }
}
