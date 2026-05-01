package com.vouch.service;

import com.vouch.dto.PersonalExpenseRequest;
import com.vouch.entity.PersonalExpense;
import com.vouch.entity.User;
import com.vouch.repository.PersonalExpenseRepository;
import com.vouch.repository.UserRepository;
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
    private final UserRepository userRepository;

    public Map<String, Object> addExpense(String phone, PersonalExpenseRequest request) {
        User user = getUserByPhone(phone);

        PersonalExpense.TransactionType type = PersonalExpense.TransactionType.EXPENSE;
        if (request.getType() != null && request.getType().equalsIgnoreCase("INCOME")) {
            type = PersonalExpense.TransactionType.INCOME;
        }

        LocalDateTime transactionDate = LocalDateTime.now();
        if (request.getTransactionDate() != null) {
            transactionDate = LocalDateTime.parse(request.getTransactionDate(), DateTimeFormatter.ISO_DATE_TIME);
        }

        PersonalExpense expense = PersonalExpense.builder()
                .user(user)
                .amount(request.getAmount())
                .description(request.getDescription())
                .category(request.getCategory())
                .type(type)
                .transactionDate(transactionDate)
                .build();

        expense = personalExpenseRepository.save(expense);

        Map<String, Object> response = new HashMap<>();
        response.put("id", expense.getId());
        response.put("amount", expense.getAmount());
        response.put("description", expense.getDescription());
        response.put("category", expense.getCategory());
        response.put("type", expense.getType().name());
        response.put("transactionDate", expense.getTransactionDate());
        response.put("message", "Transaction recorded");
        return response;
    }

    public Map<String, Object> getMonthlySummary(String phone, int year, int month) {
        User user = getUserByPhone(phone);

        LocalDateTime start = LocalDateTime.of(year, month, 1, 0, 0);
        LocalDateTime end = start.plusMonths(1);

        List<PersonalExpense> transactions = personalExpenseRepository
                .findByUserAndTransactionDateBetween(user, start, end);

        double totalIncome = transactions.stream()
                .filter(t -> t.getType() == PersonalExpense.TransactionType.INCOME)
                .mapToDouble(PersonalExpense::getAmount)
                .sum();

        double totalExpenses = transactions.stream()
                .filter(t -> t.getType() == PersonalExpense.TransactionType.EXPENSE)
                .mapToDouble(PersonalExpense::getAmount)
                .sum();

        Map<String, Double> categoryBreakdown = transactions.stream()
                .filter(t -> t.getType() == PersonalExpense.TransactionType.EXPENSE)
                .collect(Collectors.groupingBy(
                        PersonalExpense::getCategory,
                        Collectors.summingDouble(PersonalExpense::getAmount)
                ));

        Map<String, Object> response = new HashMap<>();
        response.put("year", year);
        response.put("month", month);
        response.put("totalIncome", totalIncome);
        response.put("totalExpenses", totalExpenses);
        response.put("netBalance", totalIncome - totalExpenses);
        response.put("categoryBreakdown", categoryBreakdown);
        response.put("transactionCount", transactions.size());
        return response;
    }

    public List<Map<String, Object>> getTransactions(String phone) {
        User user = getUserByPhone(phone);

        return personalExpenseRepository.findByUser(user).stream()
                .map(t -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", t.getId());
                    map.put("amount", t.getAmount());
                    map.put("description", t.getDescription());
                    map.put("category", t.getCategory());
                    map.put("type", t.getType().name());
                    map.put("transactionDate", t.getTransactionDate());
                    return map;
                }).collect(Collectors.toList());
    }

    private User getUserByPhone(String phone) {
        return userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
