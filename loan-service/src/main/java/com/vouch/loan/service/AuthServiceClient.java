package com.vouch.loan.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthServiceClient {

    private final RestTemplate restTemplate;

    @Value("${services.auth-service.url}")
    private String authServiceUrl;

    @SuppressWarnings("unchecked")
    public Map<String, Object> getUserInfoByPhone(String phone) {
        Map<String, Object> response = restTemplate.getForObject(
                authServiceUrl + "/api/internal/users/phone/" + phone, Map.class);
        if (response == null || !response.containsKey("id")) {
            throw new RuntimeException("User not found in auth-service");
        }
        return response;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getUserInfo(Long userId) {
        Map<String, Object> response = restTemplate.getForObject(
                authServiceUrl + "/api/internal/users/" + userId, Map.class);
        if (response == null || !response.containsKey("id")) {
            throw new RuntimeException("User not found in auth-service");
        }
        return response;
    }

    public Long getUserIdByPhone(String phone) {
        return ((Number) getUserInfoByPhone(phone).get("id")).longValue();
    }

    public String getUserName(Long userId) {
        Map<String, Object> info = getUserInfo(userId);
        return info.get("firstName") + " " + info.get("lastName");
    }

    public String getUserPhone(Long userId) {
        return (String) getUserInfo(userId).get("phone");
    }

    public String getUserFirstName(Long userId) {
        return (String) getUserInfo(userId).get("firstName");
    }

    public Double getUserTrustScore(Long userId) {
        return ((Number) getUserInfo(userId).get("trustScore")).doubleValue();
    }

    public void updateUserStats(Long userId, Double trustScore, Integer loansRepaidOnTime, Integer defaults) {
        Map<String, Object> body = new HashMap<>();
        if (trustScore != null)        body.put("trustScore", trustScore);
        if (loansRepaidOnTime != null) body.put("loansRepaidOnTime", loansRepaidOnTime);
        if (defaults != null)          body.put("defaults", defaults);
        try {
            restTemplate.put(authServiceUrl + "/api/internal/users/" + userId + "/stats", body);
        } catch (Exception e) {
            log.warn("Failed to update user stats for userId {}: {}", userId, e.getMessage());
        }
    }
}
