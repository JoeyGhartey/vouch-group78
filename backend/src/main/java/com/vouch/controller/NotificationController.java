package com.vouch.controller;

import com.vouch.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getNotifications(Authentication auth) {
        return ResponseEntity.ok(notificationService.getNotifications(auth.getName()));
    }

    @GetMapping("/unread")
    public ResponseEntity<List<Map<String, Object>>> getUnreadNotifications(Authentication auth) {
        return ResponseEntity.ok(notificationService.getUnreadNotifications(auth.getName()));
    }

    @GetMapping("/count")
    public ResponseEntity<Map<String, Object>> getUnreadCount(Authentication auth) {
        return ResponseEntity.ok(notificationService.getUnreadCount(auth.getName()));
    }

    @PostMapping("/{notificationId}/read")
    public ResponseEntity<Map<String, String>> markAsRead(Authentication auth, @PathVariable Long notificationId) {
        return ResponseEntity.ok(Map.of("message", notificationService.markAsRead(auth.getName(), notificationId)));
    }

    @PostMapping("/read-all")
    public ResponseEntity<Map<String, String>> markAllAsRead(Authentication auth) {
        return ResponseEntity.ok(Map.of("message", notificationService.markAllAsRead(auth.getName())));
    }
}
