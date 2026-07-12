package com.vouch.loan.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExpenseServiceClient {

    private final RestTemplate restTemplate;

    @Value("${services.expense-service.url}")
    private String expenseServiceUrl;

    public void logTransaction(Long userId, String description, Double amount, String category, String type) {
        try {
            Map<String, Object> request = Map.of(
                    "userId", userId,
                    "description", description,
                    "amount", amount,
                    "category", category,
                    "type", type
            );
            restTemplate.postForObject(
                    expenseServiceUrl + "/api/expenses/internal/personal-transaction",
                    request, Map.class);
        } catch (Exception e) {
            log.warn("Failed to log personal transaction for user {}: {}", userId, e.getMessage());
        }
    }
}
