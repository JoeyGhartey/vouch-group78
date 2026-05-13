package com.vouch.service;

import com.vouch.entity.Notification;
import com.vouch.entity.User;
import com.vouch.repository.NotificationRepository;
import com.vouch.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public void send(User user, String title, String message, Notification.NotificationType type, Long referenceId) {
        Notification notification = Notification.builder()
                .user(user).title(title).message(message).type(type).referenceId(referenceId).build();
        notificationRepository.save(notification);
    }

    public void sendToMultiple(List<User> users, String title, String message, Notification.NotificationType type, Long referenceId) {
        for (User user : users) { send(user, title, message, type, referenceId); }
    }

    public List<Map<String, Object>> getNotifications(String phone) {
        User user = getUserByPhone(phone);
        return notificationRepository.findByUserOrderByCreatedAtDesc(user).stream().map(n -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", n.getId()); map.put("title", n.getTitle()); map.put("message", n.getMessage());
            map.put("type", n.getType().name()); map.put("referenceId", n.getReferenceId());
            map.put("read", n.getRead()); map.put("createdAt", n.getCreatedAt());
            return map;
        }).collect(Collectors.toList());
    }

    public List<Map<String, Object>> getUnreadNotifications(String phone) {
        User user = getUserByPhone(phone);
        return notificationRepository.findByUserAndReadFalseOrderByCreatedAtDesc(user).stream().map(n -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", n.getId()); map.put("title", n.getTitle()); map.put("message", n.getMessage());
            map.put("type", n.getType().name()); map.put("referenceId", n.getReferenceId());
            map.put("read", n.getRead()); map.put("createdAt", n.getCreatedAt());
            return map;
        }).collect(Collectors.toList());
    }

    public Map<String, Object> getUnreadCount(String phone) {
        User user = getUserByPhone(phone);
        Map<String, Object> response = new HashMap<>();
        response.put("unreadCount", notificationRepository.countByUserAndReadFalse(user));
        return response;
    }

    public String markAsRead(String phone, Long notificationId) {
        User user = getUserByPhone(phone);
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        if (!notification.getUser().getId().equals(user.getId())) throw new RuntimeException("Not your notification");
        notification.setRead(true);
        notificationRepository.save(notification);
        return "Notification marked as read";
    }

    public String markAllAsRead(String phone) {
        User user = getUserByPhone(phone);
        List<Notification> unread = notificationRepository.findByUserAndReadFalseOrderByCreatedAtDesc(user);
        for (Notification n : unread) { n.setRead(true); }
        notificationRepository.saveAll(unread);
        return "All notifications marked as read";
    }

    private User getUserByPhone(String phone) {
        return userRepository.findByPhone(phone).orElseThrow(() -> new RuntimeException("User not found"));
    }
}
