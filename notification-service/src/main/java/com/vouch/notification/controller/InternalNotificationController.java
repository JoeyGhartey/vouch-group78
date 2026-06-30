package com.vouch.notification.controller;

import com.vouch.notification.dto.CreateNotificationRequest;
import com.vouch.notification.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/internal/notifications")
@RequiredArgsConstructor
public class InternalNotificationController {

    private final NotificationService notificationService;

    @PostMapping
    public ResponseEntity<Map<String, Object>> createNotification(@Valid @RequestBody CreateNotificationRequest request) {
        Map<String, Object> notification = notificationService.send(
                request.getUserId(),
                request.getTitle(),
                request.getMessage(),
                request.getType(),
                request.getReferenceId()
        );
        return ResponseEntity.ok(notification);
    }

    @PostMapping("/bulk")
    public ResponseEntity<Map<String, String>> createBulkNotifications(@Valid @RequestBody List<CreateNotificationRequest> requests) {
        for (CreateNotificationRequest request : requests) {
            notificationService.send(
                    request.getUserId(),
                    request.getTitle(),
                    request.getMessage(),
                    request.getType(),
                    request.getReferenceId()
            );
        }
        return ResponseEntity.ok(Map.of("message", "Notifications sent to " + requests.size() + " users"));
    }
}
