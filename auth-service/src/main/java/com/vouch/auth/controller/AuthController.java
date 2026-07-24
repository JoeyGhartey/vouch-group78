package com.vouch.auth.controller;

import com.vouch.auth.dto.AuthResponse;
import com.vouch.auth.dto.ForgotPasswordRequest;
import com.vouch.auth.dto.LoginRequest;
import com.vouch.auth.dto.RegisterRequest;
import com.vouch.auth.dto.ResetPasswordRequest;
import com.vouch.auth.security.JwtUtil;
import com.vouch.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtUtil jwtUtil;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {
        // ✅ Pass IP address for rate limiting
        String ipAddress = getClientIp(httpRequest);
        return ResponseEntity.ok(authService.login(request, ipAddress));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(authService.forgotPassword(request));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(authService.resetPassword(request));
    }

    @GetMapping("/validate")
    public ResponseEntity<Map<String, Object>> validateToken(
            @RequestHeader("Authorization") String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body(Map.of("valid", false, "message", "Missing or invalid token"));
        }
        String token = authHeader.substring(7);
        if (jwtUtil.validateToken(token)) {
            String phone = jwtUtil.extractPhone(token);
            return ResponseEntity.ok(Map.of("valid", true, "phone", phone));
        }
        return ResponseEntity.status(401).body(Map.of("valid", false, "message", "Token expired or invalid"));
    }

    @PostMapping("/push-token")
    public ResponseEntity<Map<String, String>> registerPushToken(
            Authentication auth,
            @RequestBody Map<String, String> body) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        authService.savePushToken(auth.getName(), body.get("token"));
        return ResponseEntity.ok(Map.of("message", "Push token saved"));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "running",
            "service", "auth-service",
            "version", "1.0"
        ));
    }

    // Extract the real client IP behind Railway's edge proxy. X-Forwarded-For
    // is a chain: client-claimed values first, then each proxy hop appends its
    // own view of the connection. A client can put anything it wants in the
    // header, so trusting the FIRST entry (as originally written) let an
    // attacker spoof any IP and bypass the lockout entirely. The LAST entry is
    // the one Railway's own proxy appended right before forwarding to us, which
    // is the one hop in this chain we actually trust.
    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            String[] ips = xForwardedFor.split(",");
            return ips[ips.length - 1].trim();
        }
        return request.getRemoteAddr();
    }
}
