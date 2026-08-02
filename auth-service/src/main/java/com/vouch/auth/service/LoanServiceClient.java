package com.vouch.auth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

// Used only by the self-service account-deletion flow -- auth-service is
// normally the hub every other service calls INTO, but deleting an account
// needs to check whether the user still has money in motion in loan-service
// before it's safe to soft-delete them.
@Service
@RequiredArgsConstructor
@Slf4j
public class LoanServiceClient {

    private final RestTemplate restTemplate;

    @Value("${services.loan-service.url}")
    private String loanServiceUrl;

    // Fails CLOSED (assumes an active loan exists) if loan-service is
    // unreachable -- account deletion is irreversible on the login side, so
    // uncertainty should block it rather than risk deleting someone with
    // money still outstanding.
    @SuppressWarnings("unchecked")
    public boolean hasActiveLoan(Long userId) {
        try {
            Map<String, Object> response = restTemplate.getForObject(
                    loanServiceUrl + "/api/internal/loans/user/" + userId + "/has-active", Map.class);
            return response == null || !Boolean.FALSE.equals(response.get("hasActive"));
        } catch (Exception e) {
            log.warn("Failed to check active loans for user {}: {}", userId, e.getMessage());
            return true;
        }
    }
}
