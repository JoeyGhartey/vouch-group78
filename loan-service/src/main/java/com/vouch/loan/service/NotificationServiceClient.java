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

    // Called when a circle invite is accepted/rejected/approved -- rewrites the
    // original CIRCLE_INVITE notification in place (instead of deleting it) so
    // it stays in the user's history but reads as "You accepted/declined..."
    // and no longer shows Accept/Reject buttons. Best-effort: a failure here
    // shouldn't block the actual accept/reject/approve action.
    public void updateCircleInviteNotification(Long userId, Long circleId, String title, String message, String type) {
        try {
            Map<String, Object> request = Map.of(
                    "userId", userId,
                    "title", title,
                    "message", message,
                    "type", type,
                    "referenceId", circleId
            );
            restTemplate.exchange(
                    notificationServiceUrl + "/api/internal/notifications/circle-invite",
                    org.springframework.http.HttpMethod.PUT,
                    new org.springframework.http.HttpEntity<>(request), Void.class);
        } catch (Exception e) {
            log.warn("Failed to update circle-invite notification for user {} circle {}: {}", userId, circleId, e.getMessage());
        }
    }
}
