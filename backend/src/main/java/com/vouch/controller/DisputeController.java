package com.vouch.controller;

import com.vouch.dto.DisputeRequest;
import com.vouch.dto.DisputeResponse;
import com.vouch.service.DisputeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
}
