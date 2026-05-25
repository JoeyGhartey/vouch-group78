package com.vouch.controller;

import com.vouch.dto.UpdateProfileRequest;
import com.vouch.dto.UserProfileResponse;
import com.vouch.service.UserProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserProfileService userProfileService;

    @GetMapping
    public ResponseEntity<UserProfileResponse> getMyProfile(Authentication auth) {
        return ResponseEntity.ok(userProfileService.getMyProfile(auth.getName()));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<UserProfileResponse> getUserProfile(Authentication auth, @PathVariable Long userId) {
        return ResponseEntity.ok(userProfileService.getUserProfile(auth.getName(), userId));
    }

    @PutMapping
    public ResponseEntity<UserProfileResponse> updateProfile(Authentication auth, @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(userProfileService.updateProfile(auth.getName(), request));
    }
}