package com.vouch.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthServiceClient {

    private final RestTemplate restTemplate;

    @Value("${services.auth-service.url}")
    private String authServiceUrl;

    @SuppressWarnings("unchecked")
    public Long getUserIdByPhone(String phone) {
        Map<String, Object> response = restTemplate.getForObject(
                authServiceUrl + "/api/internal/users/phone/" + phone, Map.class);
        if (response == null || !response.containsKey("id")) {
            throw new RuntimeException("User not found in auth-service");
        }
        return ((Number) response.get("id")).longValue();
    }
}
