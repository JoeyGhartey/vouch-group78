package com.vouch.loan.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    // Called when a circle invite is accepted/rejected/approved -- clears the
    // original CIRCLE_INVITE notification so it stops showing Accept/Reject
    // buttons for an invite that's already been resolved. Best-effort: a
    // failure here shouldn't block the actual accept/reject/approve action.
    public void resolveCircleInvite(Long userId, Long circleId) {
        try {
            restTemplate.exchange(
                    notificationServiceUrl + "/api/internal/notifications/circle-invite?userId=" + userId + "&circleId=" + circleId,
                    org.springframework.http.HttpMethod.DELETE, null, Void.class);
        } catch (Exception e) {
            log.warn("Failed to resolve circle-invite notification for user {} circle {}: {}", userId, circleId, e.getMessage());
        }
    }
}
