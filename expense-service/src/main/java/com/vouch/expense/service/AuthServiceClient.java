package com.vouch.expense.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value; import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.Map;

@Service @RequiredArgsConstructor
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
}
