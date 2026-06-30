package com.vouch.dispute.controller;

import com.vouch.dispute.dto.DisputeRequest;
import com.vouch.dispute.dto.DisputeResolveRequest;
import com.vouch.dispute.dto.DisputeResponse;
import com.vouch.dispute.service.DisputeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/disputes")
@RequiredArgsConstructor
public class DisputeController {

    private final DisputeService disputeService;

    @PostMapping
    public ResponseEntity<DisputeResponse> openDispute(Authentication auth, @Valid @RequestBody DisputeRequest request) {
        return ResponseEntity.ok(disputeService.openDispute(auth.getName(), request));
    }

    @GetMapping
    public ResponseEntity<List<DisputeResponse>> getMyDisputes(Authentication auth) {
        return ResponseEntity.ok(disputeService.getMyDisputes(auth.getName()));
    }

    @GetMapping("/{disputeId}")
    public ResponseEntity<DisputeResponse> getDispute(Authentication auth, @PathVariable Long disputeId) {
        return ResponseEntity.ok(disputeService.getDispute(auth.getName(), disputeId));
    }

    @GetMapping("/admin/open")
    public ResponseEntity<List<DisputeResponse>> getAllOpenDisputes(Authentication auth) {
        return ResponseEntity.ok(disputeService.getAllOpenDisputes(auth.getName()));
    }

    @PostMapping("/{disputeId}/resolve")
    public ResponseEntity<DisputeResponse> resolveDispute(
            Authentication auth, @PathVariable Long disputeId,
            @RequestBody DisputeResolveRequest request) {
        return ResponseEntity.ok(disputeService.resolveDispute(auth.getName(), disputeId, request));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "running",
            "service", "dispute-service",
            "version", "1.0"
        ));
    }
}
