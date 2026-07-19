package com.vouch.loan.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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
    public Map<String, Object> getUserInfoByEmail(String email) {
        Map<String, Object> response = restTemplate.getForObject(
                authServiceUrl + "/api/internal/users/email/" + email, Map.class);
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

    @SuppressWarnings("unchecked")
    public Map<Long, Map<String, Object>> getUsersInfo(Collection<Long> userIds) {
        Map<Long, Map<String, Object>> result = new HashMap<>();
        List<Long> distinctIds = userIds.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        if (distinctIds.isEmpty()) {
            return result;
        }
        try {
            List<Map<String, Object>> users = restTemplate.postForObject(
                    authServiceUrl + "/api/internal/users/batch",
                    Map.of("userIds", distinctIds), List.class);
            if (users != null) {
                for (Map<String, Object> user : users) {
                    Object id = user.get("id");
                    if (id instanceof Number) {
                        result.put(((Number) id).longValue(), user);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Batch user fetch failed, falling back to individual calls: {}", e.getMessage());
            for (Long id : distinctIds) {
                try {
                    result.put(id, getUserInfo(id));
                } catch (Exception ex) {
                    log.warn("Failed to fetch user {}: {}", id, ex.getMessage());
                }
            }
        }
        return result;
    }

    public static String nameOf(Map<String, Object> userInfo) {
        if (userInfo == null) {
            return null;
        }
        return userInfo.get("firstName") + " " + userInfo.get("lastName");
    }

    public static Double trustScoreOf(Map<String, Object> userInfo) {
        Object trustScore = userInfo != null ? userInfo.get("trustScore") : null;
        return trustScore instanceof Number ? ((Number) trustScore).doubleValue() : 50.0;
    }

    public Long getUserIdByPhone(String phone) {
        return ((Number) getUserInfoByPhone(phone).get("id")).longValue();
    }

    public String getUserRole(String phone) {
        return (String) getUserInfoByPhone(phone).get("role");
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
        Object trustScore = getUserInfo(userId).get("trustScore");
        return trustScore instanceof Number ? ((Number) trustScore).doubleValue() : 50.0;
    }

    public void updateUserStats(Long userId, Double trustScore, Integer loansRepaidOnTime, Integer defaults) {
        updateUserStats(userId, trustScore, loansRepaidOnTime, defaults, null, null);
    }

    public void updateUserStats(Long userId, Double trustScore, Integer loansRepaidOnTime, Integer defaults,
                                 Integer totalLoansGiven, Integer totalLoansReceived) {
        Map<String, Object> body = new HashMap<>();
        if (trustScore != null)          body.put("trustScore", trustScore);
        if (loansRepaidOnTime != null)   body.put("loansRepaidOnTime", loansRepaidOnTime);
        if (defaults != null)            body.put("defaults", defaults);
        if (totalLoansGiven != null)     body.put("totalLoansGiven", totalLoansGiven);
        if (totalLoansReceived != null)  body.put("totalLoansReceived", totalLoansReceived);
        try {
            restTemplate.put(authServiceUrl + "/api/internal/users/" + userId + "/stats", body);
        } catch (Exception e) {
            log.warn("Failed to update user stats for userId {}: {}", userId, e.getMessage());
        }
    }
}
