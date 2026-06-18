package com.vouch.expense.service;

import com.vouch.expense.dto.PersonalExpenseRequest;
import com.vouch.expense.dto.SpendingLimitRequest;
import com.vouch.expense.entity.PersonalExpense;
import com.vouch.expense.entity.SpendingLimit;
import com.vouch.expense.repository.PersonalExpenseRepository;
import com.vouch.expense.repository.SpendingLimitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PersonalExpenseService {

    private final PersonalExpenseRepository personalExpenseRepository;
    private final SpendingLimitRepository spendingLimitRepository;
    private final AuthServiceClient authServiceClient;
    private final NotificationServiceClient notificationServiceClient;

    public Map<String, Object> addExpense(String phone, PersonalExpenseRequest request) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        PersonalExpense.TransactionType type = (request.getType() != null && request.getType().equalsIgnoreCase("INCOME"))
                ? PersonalExpense.TransactionType.INCOME : PersonalExpense.TransactionType.EXPENSE;
        LocalDateTime txDate = request.getTransactionDate() != null
                ? LocalDateTime.parse(request.getTransactionDate(), DateTimeFormatter.ISO_DATE_TIME) : LocalDateTime.now();

        PersonalExpense expense = PersonalExpense.builder()
                .userId(userId).amount(request.getAmount()).description(request.getDescription())
                .category(request.getCategory()).type(type).transactionDate(txDate).build();
        expense = personalExpenseRepository.save(expense);

        if (type == PersonalExpense.TransactionType.EXPENSE) checkSpendingLimit(userId, request.getCategory());

        Map<String, Object> r = new HashMap<>();
        r.put("id", expense.getId()); r.put("amount", expense.getAmount()); r.put("description", expense.getDescription());
        r.put("category", expense.getCategory()); r.put("type", expense.getType().name());
        r.put("transactionDate", expense.getTransactionDate()); r.put("message", "Transaction recorded");
        return r;
    }

    public Map<String, Object> getMonthlySummary(String phone, int year, int month) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        LocalDateTime start = LocalDateTime.of(year, month, 1, 0, 0);
        LocalDateTime end = start.plusMonths(1);
        List<PersonalExpense> txs = personalExpenseRepository.findByUserIdAndTransactionDateBetween(userId, start, end);

        double income = txs.stream().filter(t -> t.getType() == PersonalExpense.TransactionType.INCOME).mapToDouble(PersonalExpense::getAmount).sum();
        double expenses = txs.stream().filter(t -> t.getType() == PersonalExpense.TransactionType.EXPENSE).mapToDouble(PersonalExpense::getAmount).sum();
        Map<String, Double> cats = txs.stream().filter(t -> t.getType() == PersonalExpense.TransactionType.EXPENSE)
                .collect(Collectors.groupingBy(PersonalExpense::getCategory, Collectors.summingDouble(PersonalExpense::getAmount)));

        List<SpendingLimit> limits = spendingLimitRepository.findByUserId(userId);
        Map<String, Object> limitStatus = new HashMap<>();
        for (SpendingLimit l : limits) {
            double spent = cats.getOrDefault(l.getCategory(), 0.0);
            Map<String, Object> s = new HashMap<>();
            s.put("limit", l.getMonthlyLimit()); s.put("spent", spent); s.put("remaining", l.getMonthlyLimit() - spent);
            s.put("percentUsed", Math.round(spent / l.getMonthlyLimit() * 100 * 10.0) / 10.0);
            s.put("exceeded", spent > l.getMonthlyLimit());
            limitStatus.put(l.getCategory(), s);
        }

        Map<String, Object> r = new HashMap<>();
        r.put("year", year); r.put("month", month); r.put("totalIncome", income); r.put("totalExpenses", expenses);
        r.put("netBalance", income - expenses); r.put("categoryBreakdown", cats);
        r.put("spendingLimits", limitStatus); r.put("transactionCount", txs.size());
        return r;
    }

    public List<Map<String, Object>> getTransactions(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        return personalExpenseRepository.findByUserId(userId).stream().map(t -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", t.getId()); m.put("amount", t.getAmount()); m.put("description", t.getDescription());
            m.put("category", t.getCategory()); m.put("type", t.getType().name()); m.put("transactionDate", t.getTransactionDate());
            return m;
        }).collect(Collectors.toList());
    }

    public Map<String, Object> setSpendingLimit(String phone, SpendingLimitRequest request) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        SpendingLimit limit = spendingLimitRepository.findByUserIdAndCategory(userId, request.getCategory())
                .orElse(SpendingLimit.builder().userId(userId).category(request.getCategory()).build());
        limit.setMonthlyLimit(request.getMonthlyLimit());
        spendingLimitRepository.save(limit);
        Map<String, Object> r = new HashMap<>();
        r.put("category", limit.getCategory()); r.put("monthlyLimit", limit.getMonthlyLimit()); r.put("message", "Spending limit set");
        return r;
    }

    public List<Map<String, Object>> getSpendingLimits(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        return spendingLimitRepository.findByUserId(userId).stream().map(l -> {
            Map<String, Object> m = new HashMap<>(); m.put("id", l.getId()); m.put("category", l.getCategory()); m.put("monthlyLimit", l.getMonthlyLimit()); return m;
        }).collect(Collectors.toList());
    }

    public String deleteSpendingLimit(String phone, Long limitId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        SpendingLimit limit = spendingLimitRepository.findById(limitId).orElseThrow(() -> new RuntimeException("Not found"));
        if (!limit.getUserId().equals(userId)) throw new RuntimeException("Not yours");
        spendingLimitRepository.delete(limit);
        return "Spending limit deleted";
    }

    private void checkSpendingLimit(Long userId, String category) {
        SpendingLimit limit = spendingLimitRepository.findByUserIdAndCategory(userId, category).orElse(null);
        if (limit == null) return;
        LocalDateTime start = LocalDateTime.now().withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0);
        double spent = personalExpenseRepository.findByUserIdAndTransactionDateBetween(userId, start, start.plusMonths(1)).stream()
                .filter(t -> t.getType() == PersonalExpense.TransactionType.EXPENSE && t.getCategory().equals(category))
                .mapToDouble(PersonalExpense::getAmount).sum();
        double pct = spent / limit.getMonthlyLimit() * 100;
        if (pct >= 100) notificationServiceClient.send(userId, "Limit Exceeded", "You exceeded your GHS " + limit.getMonthlyLimit() + " limit for " + category, "SPENDING_LIMIT_WARNING", limit.getId());
        else if (pct >= 90) notificationServiceClient.send(userId, "Limit Warning", Math.round(pct) + "% of your " + category + " limit used", "SPENDING_LIMIT_WARNING", limit.getId());
    }
}
