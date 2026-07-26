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

    // Fails OPEN (returns false / "no unsettled expenses found") if expense-service
    // is unreachable, so a temporary outage there can't lock every member out of
    // leaving/being removed from their circles. Mirrors how logTransaction above
    // tolerates failures rather than block the primary action.
    @SuppressWarnings("unchecked")
    public boolean hasUnsettledExpenses(Long userId, Long circleId) {
        try {
            Map<String, Object> response = restTemplate.getForObject(
                    expenseServiceUrl + "/api/expenses/internal/circle/" + circleId + "/user/" + userId + "/has-unsettled",
                    Map.class);
            return response != null && Boolean.TRUE.equals(response.get("hasUnsettled"));
        } catch (Exception e) {
            log.warn("Failed to check unsettled expenses for user {} in circle {}: {}", userId, circleId, e.getMessage());
            return false;
        }
    }

    // Fails CLOSED (treats the circle as if it has expense history) on this one --
    // deleting a circle is rare, creator-only, and irreversible, so if we can't
    // confirm it's actually safe, we should not proceed.
    @SuppressWarnings("unchecked")
    public boolean circleHasAnyExpenses(Long circleId) {
        try {
            Map<String, Object> response = restTemplate.getForObject(
                    expenseServiceUrl + "/api/expenses/internal/circle/" + circleId + "/has-any", Map.class);
            return response == null || !Boolean.FALSE.equals(response.get("hasAny"));
        } catch (Exception e) {
            log.warn("Failed to check expense history for circle {}: {}", circleId, e.getMessage());
            return true;
        }
    }
}
