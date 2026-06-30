package com.vouch.expense.service;

import com.vouch.expense.entity.ExpenseSplit;
import com.vouch.expense.entity.SharedExpense;
import com.vouch.expense.repository.ExpenseSplitRepository;
import com.vouch.expense.repository.SharedExpenseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DebtSimplificationService {

    private final SharedExpenseRepository sharedExpenseRepository;
    private final ExpenseSplitRepository expenseSplitRepository;
    private final AuthServiceClient authServiceClient;

    public Map<String, Object> getSimplifiedDebts(String phone, Long circleId) {
        authServiceClient.getUserIdByPhone(phone);

        List<SharedExpense> expenses = sharedExpenseRepository.findByCircleId(circleId);
        Map<String, Double> rawDebts = new HashMap<>();

        for (SharedExpense expense : expenses) {
            List<ExpenseSplit> splits = expenseSplitRepository.findBySharedExpense(expense);
            for (ExpenseSplit split : splits) {
                if (!split.getSettled() && !split.getUserId().equals(expense.getPaidById())) {
                    String key = split.getUserId() + "->" + expense.getPaidById();
                    rawDebts.merge(key, split.getAmountOwed(), Double::sum);
                }
            }
        }

        Map<Long, Double> netBalances = new HashMap<>();
        Map<Long, String> userNames = new HashMap<>();

        for (Map.Entry<String, Double> entry : rawDebts.entrySet()) {
            String[] parts = entry.getKey().split("->");
            Long debtorId = Long.parseLong(parts[0]);
            Long creditorId = Long.parseLong(parts[1]);
            netBalances.merge(debtorId, -entry.getValue(), Double::sum);
            netBalances.merge(creditorId, entry.getValue(), Double::sum);
        }

        for (Long userId : netBalances.keySet()) {
            userNames.computeIfAbsent(userId, id -> authServiceClient.getUserName(id));
        }

        List<long[]> debtors = new ArrayList<>();
        List<long[]> creditors = new ArrayList<>();
        for (Map.Entry<Long, Double> entry : netBalances.entrySet()) {
            double balance = Math.round(entry.getValue() * 100.0) / 100.0;
            if (balance < -0.01) debtors.add(new long[]{entry.getKey(), Math.round(Math.abs(balance) * 100)});
            else if (balance > 0.01) creditors.add(new long[]{entry.getKey(), Math.round(balance * 100)});
        }
        debtors.sort((a, b) -> Long.compare(b[1], a[1]));
        creditors.sort((a, b) -> Long.compare(b[1], a[1]));

        List<Map<String, Object>> simplifiedTransactions = new ArrayList<>();
        int i = 0, j = 0;
        while (i < debtors.size() && j < creditors.size()) {
            long settleAmount = Math.min(debtors.get(i)[1], creditors.get(j)[1]);
            if (settleAmount > 0) {
                Map<String, Object> tx = new HashMap<>();
                tx.put("fromId", debtors.get(i)[0]); tx.put("fromName", userNames.getOrDefault(debtors.get(i)[0], "Unknown"));
                tx.put("toId", creditors.get(j)[0]); tx.put("toName", userNames.getOrDefault(creditors.get(j)[0], "Unknown"));
                tx.put("amount", settleAmount / 100.0);
                simplifiedTransactions.add(tx);
            }
            debtors.get(i)[1] -= settleAmount; creditors.get(j)[1] -= settleAmount;
            if (debtors.get(i)[1] == 0) i++;
            if (creditors.get(j)[1] == 0) j++;
        }

        List<Map<String, Object>> originalTransactions = rawDebts.entrySet().stream().map(entry -> {
            String[] parts = entry.getKey().split("->");
            Map<String, Object> tx = new HashMap<>();
            tx.put("fromId", Long.parseLong(parts[0])); tx.put("fromName", userNames.getOrDefault(Long.parseLong(parts[0]), "Unknown"));
            tx.put("toId", Long.parseLong(parts[1])); tx.put("toName", userNames.getOrDefault(Long.parseLong(parts[1]), "Unknown"));
            tx.put("amount", Math.round(entry.getValue() * 100.0) / 100.0);
            return tx;
        }).collect(Collectors.toList());

        List<Map<String, Object>> balanceSummary = netBalances.entrySet().stream()
                .filter(e -> Math.abs(Math.round(e.getValue() * 100.0) / 100.0) > 0.01)
                .map(e -> { double b = Math.round(e.getValue() * 100.0) / 100.0; Map<String, Object> bs = new HashMap<>();
                    bs.put("userId", e.getKey()); bs.put("userName", userNames.getOrDefault(e.getKey(), "Unknown"));
                    bs.put("netBalance", b); bs.put("status", b > 0 ? "OWED" : "OWES"); bs.put("amount", Math.abs(b)); return bs;
                }).collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("circleId", circleId);
        response.put("originalTransactionCount", originalTransactions.size());
        response.put("simplifiedTransactionCount", simplifiedTransactions.size());
        response.put("transactionsSaved", originalTransactions.size() - simplifiedTransactions.size());
        response.put("originalTransactions", originalTransactions);
        response.put("simplifiedTransactions", simplifiedTransactions);
        response.put("netBalances", balanceSummary);
        return response;
    }

    public Map<String, Object> getMyDebts(String phone, Long circleId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Map<String, Object> allDebts = getSimplifiedDebts(phone, circleId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> simplified = (List<Map<String, Object>>) allDebts.get("simplifiedTransactions");

        List<Map<String, Object>> iOwe = simplified.stream().filter(tx -> ((Number) tx.get("fromId")).longValue() == userId).collect(Collectors.toList());
        List<Map<String, Object>> owedToMe = simplified.stream().filter(tx -> ((Number) tx.get("toId")).longValue() == userId).collect(Collectors.toList());
        double totalIOwe = iOwe.stream().mapToDouble(tx -> ((Number) tx.get("amount")).doubleValue()).sum();
        double totalOwedToMe = owedToMe.stream().mapToDouble(tx -> ((Number) tx.get("amount")).doubleValue()).sum();

        Map<String, Object> response = new HashMap<>();
        response.put("userId", userId); response.put("userName", authServiceClient.getUserName(userId));
        response.put("circleId", circleId); response.put("iOwe", iOwe); response.put("owedToMe", owedToMe);
        response.put("totalIOwe", Math.round(totalIOwe * 100.0) / 100.0);
        response.put("totalOwedToMe", Math.round(totalOwedToMe * 100.0) / 100.0);
        response.put("netPosition", Math.round((totalOwedToMe - totalIOwe) * 100.0) / 100.0);
        return response;
    }
}
