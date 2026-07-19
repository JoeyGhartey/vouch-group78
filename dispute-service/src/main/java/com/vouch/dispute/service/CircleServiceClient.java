package com.vouch.dispute.service;

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

    @SuppressWarnings("unchecked")
    public Map<String, Object> getCircleInfo(Long circleId) {
        Map<String, Object> response = restTemplate.getForObject(
                loanServiceUrl + "/api/internal/circles/" + circleId, Map.class);
        if (response == null || !response.containsKey("id")) {
            throw new RuntimeException("Circle not found in loan-service");
        }
        return response;
    }
}
