package com.vouch.expense.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value; import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor @Slf4j
public class AuthServiceClient {
    private final RestTemplate restTemplate;
    @Value("${services.auth-service.url}") private String authServiceUrl;

    @SuppressWarnings("unchecked")
    public Map<String, Object> getUserInfoByPhone(String phone) {
        Map<String, Object> r = restTemplate.getForObject(authServiceUrl + "/api/internal/users/phone/" + phone, Map.class);
        if (r == null || !r.containsKey("id")) throw new RuntimeException("User not found in auth-service");
        return r;
    }
    @SuppressWarnings("unchecked")
    public Map<String, Object> getUserInfo(Long userId) {
        Map<String, Object> r = restTemplate.getForObject(authServiceUrl + "/api/internal/users/" + userId, Map.class);
        if (r == null || !r.containsKey("id")) throw new RuntimeException("User not found in auth-service");
        return r;
    }
    public Long getUserIdByPhone(String phone) { return ((Number) getUserInfoByPhone(phone).get("id")).longValue(); }
    public String getUserName(Long userId) { Map<String, Object> i = getUserInfo(userId); return i.get("firstName") + " " + i.get("lastName"); }

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
}
