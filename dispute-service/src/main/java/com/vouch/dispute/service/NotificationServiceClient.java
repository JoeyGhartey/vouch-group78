package com.vouch.dispute.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationServiceClient {

    private final RestTemplate restTemplate;

    @Value("${services.notification-service.url}")
    private String notificationServiceUrl;

    // @Async -- same fix as loan-service's copy of this class: don't block the
    // caller's HTTP response on this 3-hop chain finishing. Failure is
    // already caught and logged below, not thrown, so this only changes timing.
    @Async
    public void send(Long userId, String title, String message, String type, Long referenceId) {
        try {
            Map<String, Object> request = Map.of(
                    "userId", userId,
                    "title", title,
                    "message", message,
                    "type", type,
                    "referenceId", referenceId != null ? referenceId : 0
            );
            restTemplate.postForObject(
                    notificationServiceUrl + "/api/internal/notifications",
                    request, Map.class);
        } catch (Exception e) {
            log.warn("Failed to send notification to user {}: {}", userId, e.getMessage());
        }
    }
}
