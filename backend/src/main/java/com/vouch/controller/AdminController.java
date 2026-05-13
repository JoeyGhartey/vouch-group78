package com.vouch.controller;

import com.vouch.dto.DisputeResolveRequest;
import com.vouch.dto.DisputeResponse;
import com.vouch.entity.User;
import com.vouch.repository.LoanRepository;
import com.vouch.repository.UserRepository;
import com.vouch.service.DisputeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final DisputeService disputeService;
    private final UserRepository userRepository;
    private final LoanRepository loanRepository;

    @GetMapping("/disputes")
    public ResponseEntity<List<DisputeResponse>> getOpenDisputes(Authentication auth) {
        return ResponseEntity.ok(disputeService.getAllOpenDisputes(auth.getName()));
    }

    @PostMapping("/disputes/{disputeId}/resolve")
    public ResponseEntity<DisputeResponse> resolveDispute(Authentication auth, @PathVariable Long disputeId, @Valid @RequestBody DisputeResolveRequest request) {
        return ResponseEntity.ok(disputeService.resolveDispute(auth.getName(), disputeId, request));
    }

    @GetMapping("/analytics")
    public ResponseEntity<Map<String, Object>> getPlatformAnalytics(Authentication auth) {
        User admin = userRepository.findByPhone(auth.getName()).orElseThrow(() -> new RuntimeException("Not found"));
        if (admin.getRole() != User.Role.ADMIN) throw new RuntimeException("Admin only");
        Map<String, Object> a = new HashMap<>();
        a.put("totalUsers", userRepository.count());
        a.put("totalLoans", loanRepository.count());
        a.put("activeLoans", loanRepository.findByStatus(com.vouch.entity.Loan.LoanStatus.ACTIVE).size());
        a.put("repaidLoans", loanRepository.findByStatus(com.vouch.entity.Loan.LoanStatus.REPAID).size());
        a.put("defaultedLoans", loanRepository.findByStatus(com.vouch.entity.Loan.LoanStatus.DEFAULTED).size());
        return ResponseEntity.ok(a);
    }

    @PostMapping("/users/{userId}/ban")
    public ResponseEntity<Map<String, String>> banUser(Authentication auth, @PathVariable Long userId) {
        User admin = userRepository.findByPhone(auth.getName()).orElseThrow(() -> new RuntimeException("Not found"));
        if (admin.getRole() != User.Role.ADMIN) throw new RuntimeException("Admin only");
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
        user.setPermanentBan(true);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", user.getFirstName() + " has been banned"));
    }

    @PostMapping("/users/{userId}/unban")
    public ResponseEntity<Map<String, String>> unbanUser(Authentication auth, @PathVariable Long userId) {
        User admin = userRepository.findByPhone(auth.getName()).orElseThrow(() -> new RuntimeException("Not found"));
        if (admin.getRole() != User.Role.ADMIN) throw new RuntimeException("Admin only");
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
        user.setPermanentBan(false); user.setBorrowingSuspended(false); user.setBorrowingSuspendedUntil(null);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", user.getFirstName() + " has been unbanned"));
    }
}
