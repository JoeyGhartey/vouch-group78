package com.vouch.auth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

// Used only by the self-service account-deletion flow -- see LoanServiceClient
// for why auth-service needs an outbound client at all here.
@Service
@RequiredArgsConstructor
@Slf4j
public class ExpenseServiceClient {

    private final RestTemplate restTemplate;

    @Value("${services.expense-service.url}")
    private String expenseServiceUrl;

    // Fails CLOSED, same reasoning as LoanServiceClient.hasActiveLoan --
    // account deletion is irreversible on the login side, so an unreachable
    // expense-service should block deletion rather than risk it.
    @SuppressWarnings("unchecked")
    public boolean hasUnsettledExpenses(Long userId) {
        try {
            Map<String, Object> response = restTemplate.getForObject(
                    expenseServiceUrl + "/api/expenses/internal/user/" + userId + "/has-unsettled", Map.class);
            return response == null || !Boolean.FALSE.equals(response.get("hasUnsettled"));
        } catch (Exception e) {
            log.warn("Failed to check unsettled expenses for user {}: {}", userId, e.getMessage());
            return true;
        }
    }
}
