package com.vouch.notification.service;

import com.vouch.notification.entity.Notification;
import com.vouch.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final AuthServiceClient authServiceClient;
    private final RestTemplate restTemplate;

    public Map<String, Object> send(Long userId, String title, String message, String type, Long referenceId) {
        Notification notification = Notification.builder()
                .userId(userId)
                .title(title)
                .message(message)
                .type(Notification.NotificationType.valueOf(type))
                .referenceId(referenceId)
                .build();
        Notification saved = notificationRepository.save(notification);

        try {
            String pushToken = authServiceClient.getPushToken(userId);
            if (pushToken != null) {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                Map<String, Object> pushBody = Map.of(
                    "to", pushToken,
                    "title", title,
                    "body", message,
                    "data", Map.of("type", type, "referenceId", referenceId != null ? referenceId : 0)
                );
                restTemplate.postForObject(
                    "https://exp.host/--/api/v2/push/send",
                    new HttpEntity<>(pushBody, headers),
                    Map.class
                );
            }
        } catch (Exception e) {
            log.warn("Push delivery failed for user {}: {}", userId, e.getMessage());
        }

        return mapToResponse(saved);
    }

    public List<Map<String, Object>> getNotifications(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    public List<Map<String, Object>> getUnreadNotifications(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        return notificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    public Map<String, Object> getUnreadCount(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Map<String, Object> response = new HashMap<>();
        response.put("unreadCount", notificationRepository.countByUserIdAndReadFalse(userId));
        return response;
    }

    public String markAsRead(String phone, Long notificationId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        if (!notification.getUserId().equals(userId)) {
            throw new RuntimeException("Not your notification");
        }
        notification.setRead(true);
        notificationRepository.save(notification);
        return "Notification marked as read";
    }

    public String markAllAsRead(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        List<Notification> unread = notificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId);
        for (Notification n : unread) {
            n.setRead(true);
        }
        notificationRepository.saveAll(unread);
        return "All notifications marked as read";
    }

    private Map<String, Object> mapToResponse(Notification n) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", n.getId());
        map.put("userId", n.getUserId());
        map.put("title", n.getTitle());
        map.put("message", n.getMessage());
        map.put("type", n.getType().name());
        map.put("referenceId", n.getReferenceId());
        map.put("read", n.getRead());
        map.put("createdAt", n.getCreatedAt());
        return map;
    }
}
