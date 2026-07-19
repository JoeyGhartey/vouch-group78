package com.vouch.expense.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class CircleServiceClient {

    private final RestTemplate restTemplate;

    @Value("${services.loan-service.url}")
    private String loanServiceUrl;

    // Throws if the given user isn't an active member of the given circle.
    // Every circle-scoped read/write in expense-service must call this first —
    // previously nothing checked circle membership at all here.
    @SuppressWarnings("unchecked")
    public void validateMembership(Long circleId, Long userId) {
        Map<String, Object> response = restTemplate.getForObject(
                loanServiceUrl + "/api/internal/circles/" + circleId + "/members/" + userId, Map.class);
        boolean active = response != null && Boolean.TRUE.equals(response.get("active"));
        if (!active) {
            throw new RuntimeException("You are not an active member of this circle");
        }
    }
}
