package com.vouch.auth.service;

import com.vouch.auth.dto.UpdateProfileRequest;
import com.vouch.auth.dto.UserProfileResponse;
import com.vouch.auth.entity.User;
import com.vouch.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserProfileResponse getMyProfile(String phone) {
        return mapToResponse(getUserByPhone(phone));
    }

    public UserProfileResponse getUserProfile(String phone, Long userId) {
        getUserByPhone(phone);
        return mapToResponse(userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found")));
    }

    public UserProfileResponse updateProfile(String phone, UpdateProfileRequest request) {
        User user = getUserByPhone(phone);
        if (request.getFirstName() != null && !request.getFirstName().isBlank()) user.setFirstName(request.getFirstName());
        if (request.getLastName() != null && !request.getLastName().isBlank()) user.setLastName(request.getLastName());
        if (request.getEmail() != null) user.setEmail(request.getEmail());
        if (request.getMomoProvider() != null) user.setMomoProvider(request.getMomoProvider());
        if (request.getMomoNumber() != null) user.setMomoNumber(request.getMomoNumber());
        return mapToResponse(userRepository.save(user));
    }

    public String changePassword(String phone, String oldPassword, String newPassword) {
        User user = getUserByPhone(phone);
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new RuntimeException("Current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        return "Password changed successfully";
    }

    public User getUserByPhone(String phone) {
        return userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private UserProfileResponse mapToResponse(User u) {
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
