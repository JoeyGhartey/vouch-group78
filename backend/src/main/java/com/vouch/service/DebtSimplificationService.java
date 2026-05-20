package com.vouch.service;

import com.vouch.entity.*;
import com.vouch.repository.*;
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
    private final CircleRepository circleRepository;
    private final CircleMemberRepository circleMemberRepository;
    private final UserRepository userRepository;

    /**
     * Get simplified debts for a circle.
     * 
     * Example: A owes B GHS 50, B owes C GHS 30
     * Simplified: A owes B GHS 20, A owes C GHS 30
     * 
     * Algorithm:
     * 1. Calculate net balance for each person (positive = owed money, negative = owes money)
     * 2. Match debtors with creditors to minimize transactions
     */
    public Map<String, Object> getSimplifiedDebts(String phone, Long circleId) {
        User user = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));

        // Verify membership
        circleMemberRepository.findByCircleAndUser(circle, user)
                .filter(m -> m.getStatus() == CircleMember.MemberStatus.ACTIVE)
                .orElseThrow(() -> new RuntimeException("You are not an active member of this circle"));

        // Get all unsettled splits in this circle
        List<SharedExpense> expenses = sharedExpenseRepository.findByCircle(circle);
        
        // Build raw debt map: who owes who how much
        // Key: "debtorId->creditorId", Value: amount
        Map<String, Double> rawDebts = new HashMap<>();
        
        for (SharedExpense expense : expenses) {
            List<ExpenseSplit> splits = expenseSplitRepository.findBySharedExpense(expense);
            User paidBy = expense.getPaidBy();
            
            for (ExpenseSplit split : splits) {
                if (!split.getSettled() && !split.getUser().getId().equals(paidBy.getId())) {
                    // This person owes money to the person who paid
                    String key = split.getUser().getId() + "->" + paidBy.getId();
                    rawDebts.merge(key, split.getAmountOwed(), Double::sum);
                }
            }
        }

        // Calculate net balances for each person
        // Positive = they are owed money (creditor)
        // Negative = they owe money (debtor)
        Map<Long, Double> netBalances = new HashMap<>();
        Map<Long, String> userNames = new HashMap<>();

        for (Map.Entry<String, Double> entry : rawDebts.entrySet()) {
            String[] parts = entry.getKey().split("->");
            Long debtorId = Long.parseLong(parts[0]);
            Long creditorId = Long.parseLong(parts[1]);
            double amount = entry.getValue();

            netBalances.merge(debtorId, -amount, Double::sum);
            netBalances.merge(creditorId, amount, Double::sum);
        }

        // Load user names
        for (Long userId : netBalances.keySet()) {
            userRepository.findById(userId).ifPresent(u -> 
                userNames.put(userId, u.getFirstName() + " " + u.getLastName()));
        }

        // Separate into debtors (negative balance) and creditors (positive balance)
        List<long[]> debtors = new ArrayList<>(); // [userId, amount in pesewas]
        List<long[]> creditors = new ArrayList<>();

        for (Map.Entry<Long, Double> entry : netBalances.entrySet()) {
            double balance = Math.round(entry.getValue() * 100.0) / 100.0;
            if (balance < -0.01) {
                debtors.add(new long[]{entry.getKey(), Math.round(Math.abs(balance) * 100)});
            } else if (balance > 0.01) {
                creditors.add(new long[]{entry.getKey(), Math.round(balance * 100)});
            }
        }

        // Sort: largest debtor first, largest creditor first
        debtors.sort((a, b) -> Long.compare(b[1], a[1]));
        creditors.sort((a, b) -> Long.compare(b[1], a[1]));

        // Greedy algorithm to minimize transactions
        List<Map<String, Object>> simplifiedTransactions = new ArrayList<>();
        int i = 0, j = 0;

        while (i < debtors.size() && j < creditors.size()) {
            long debtorId = debtors.get(i)[0];
            long creditorId = creditors.get(j)[0];
            long debtAmount = debtors.get(i)[1];
            long creditAmount = creditors.get(j)[1];

            long settleAmount = Math.min(debtAmount, creditAmount);

            if (settleAmount > 0) {
                Map<String, Object> transaction = new HashMap<>();
                transaction.put("fromId", debtorId);
                transaction.put("fromName", userNames.getOrDefault(debtorId, "Unknown"));
                transaction.put("toId", creditorId);
                transaction.put("toName", userNames.getOrDefault(creditorId, "Unknown"));
                transaction.put("amount", settleAmount / 100.0);
                simplifiedTransactions.add(transaction);
            }

            debtors.get(i)[1] -= settleAmount;
            creditors.get(j)[1] -= settleAmount;

            if (debtors.get(i)[1] == 0) i++;
            if (creditors.get(j)[1] == 0) j++;
        }

        // Build original (unsimplified) transactions for comparison
        List<Map<String, Object>> originalTransactions = new ArrayList<>();
        for (Map.Entry<String, Double> entry : rawDebts.entrySet()) {
            String[] parts = entry.getKey().split("->");
            Long debtorId = Long.parseLong(parts[0]);
            Long creditorId = Long.parseLong(parts[1]);

            Map<String, Object> tx = new HashMap<>();
            tx.put("fromId", debtorId);
            tx.put("fromName", userNames.getOrDefault(debtorId, "Unknown"));
            tx.put("toId", creditorId);
            tx.put("toName", userNames.getOrDefault(creditorId, "Unknown"));
            tx.put("amount", Math.round(entry.getValue() * 100.0) / 100.0);
            originalTransactions.add(tx);
        }

        // Build response
        Map<String, Object> response = new HashMap<>();
        response.put("circleId", circleId);
        response.put("circleName", circle.getName());
        response.put("originalTransactionCount", originalTransactions.size());
        response.put("simplifiedTransactionCount", simplifiedTransactions.size());
        response.put("transactionsSaved", originalTransactions.size() - simplifiedTransactions.size());
        response.put("originalTransactions", originalTransactions);
        response.put("simplifiedTransactions", simplifiedTransactions);

        // Net balances summary
        List<Map<String, Object>> balanceSummary = new ArrayList<>();
        for (Map.Entry<Long, Double> entry : netBalances.entrySet()) {
            double balance = Math.round(entry.getValue() * 100.0) / 100.0;
            if (Math.abs(balance) > 0.01) {
                Map<String, Object> bs = new HashMap<>();
                bs.put("userId", entry.getKey());
                bs.put("userName", userNames.getOrDefault(entry.getKey(), "Unknown"));
                bs.put("netBalance", balance);
                bs.put("status", balance > 0 ? "OWED" : "OWES");
                bs.put("amount", Math.abs(balance));
                balanceSummary.add(bs);
            }
        }
        response.put("netBalances", balanceSummary);

        log.info("Debt simplification for circle {}: {} original -> {} simplified transactions",
                circleId, originalTransactions.size(), simplifiedTransactions.size());

        return response;
    }

    /**
     * Get what the current user specifically owes or is owed in a circle.
     */
    public Map<String, Object> getMyDebts(String phone, Long circleId) {
        User user = getUserByPhone(phone);
        Map<String, Object> allDebts = getSimplifiedDebts(phone, circleId);

        List<Map<String, Object>> simplified = (List<Map<String, Object>>) allDebts.get("simplifiedTransactions");

        List<Map<String, Object>> iOwe = simplified.stream()
                .filter(tx -> tx.get("fromId").equals(user.getId()))
                .collect(Collectors.toList());

        List<Map<String, Object>> owedToMe = simplified.stream()
                .filter(tx -> tx.get("toId").equals(user.getId()))
                .collect(Collectors.toList());

        double totalIOwe = iOwe.stream().mapToDouble(tx -> (Double) tx.get("amount")).sum();
        double totalOwedToMe = owedToMe.stream().mapToDouble(tx -> (Double) tx.get("amount")).sum();

        Map<String, Object> response = new HashMap<>();
        response.put("userId", user.getId());
        response.put("userName", user.getFirstName() + " " + user.getLastName());
        response.put("circleId", circleId);
        response.put("iOwe", iOwe);
        response.put("owedToMe", owedToMe);
        response.put("totalIOwe", Math.round(totalIOwe * 100.0) / 100.0);
        response.put("totalOwedToMe", Math.round(totalOwedToMe * 100.0) / 100.0);
        response.put("netPosition", Math.round((totalOwedToMe - totalIOwe) * 100.0) / 100.0);
        return response;
    }

    private User getUserByPhone(String phone) {
        return userRepository.findByPhone(phone).orElseThrow(() -> new RuntimeException("User not found"));
    }
}
