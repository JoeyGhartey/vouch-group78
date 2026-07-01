package com.vouch.auth.controller;

import com.vouch.auth.dto.UpdateUserStatsRequest;
import com.vouch.auth.dto.UserProfileResponse;
import com.vouch.auth.entity.User;
import com.vouch.auth.repository.UserRepository;
import com.vouch.auth.service.UserProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/internal/users")
@RequiredArgsConstructor
public class InternalUserController {

    private final UserRepository userRepository;
    private final UserProfileService userProfileService;

    @GetMapping("/{userId}")
    public ResponseEntity<UserProfileResponse> getUserById(@PathVariable Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(buildResponse(user));
    }

    @GetMapping("/phone/{phone}")
    public ResponseEntity<UserProfileResponse> getUserByPhone(@PathVariable String phone) {
        User user = userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(buildResponse(user));
    }

    @GetMapping("/{userId}/push-token")
    public ResponseEntity<Map<String, String>> getPushToken(@PathVariable Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(Map.of("pushToken", user.getPushToken() != null ? user.getPushToken() : ""));
    }

    @PutMapping("/{userId}/stats")
    public ResponseEntity<Void> updateUserStats(
            @PathVariable Long userId,
            @RequestBody UpdateUserStatsRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (request.getTrustScore() != null)         user.setTrustScore(request.getTrustScore());
        if (request.getLoansRepaidOnTime() != null)  user.setLoansRepaidOnTime(request.getLoansRepaidOnTime());
        if (request.getTotalLoansGiven() != null)    user.setTotalLoansGiven(request.getTotalLoansGiven());
        if (request.getTotalLoansReceived() != null) user.setTotalLoansReceived(request.getTotalLoansReceived());
        if (request.getDefaults() != null)           user.setDefaults(request.getDefaults());
        userRepository.save(user);
        return ResponseEntity.ok().build();
    }

    private UserProfileResponse buildResponse(User u) {
        return UserProfileResponse.builder()
                .id(u.getId())
                .phone(u.getPhone())
                .firstName(u.getFirstName())
                .lastName(u.getLastName())
                .email(u.getEmail())
                .momoProvider(u.getMomoProvider())
                .momoNumber(u.getMomoNumber())
                .trustScore(u.getTrustScore())
                .totalLoansGiven(u.getTotalLoansGiven())
                .totalLoansReceived(u.getTotalLoansReceived())
                .loansRepaidOnTime(u.getLoansRepaidOnTime())
                .defaults(u.getDefaults())
                .borrowingSuspended(u.getBorrowingSuspended())
                .borrowingSuspendedUntil(u.getBorrowingSuspendedUntil())
                .permanentBan(u.getPermanentBan())
                .createdAt(u.getCreatedAt())
                .lastActive(u.getLastActive())
                .role(u.getRole().name())
                .build();
    }
}
