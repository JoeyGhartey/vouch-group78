package com.vouch.dispute.service;

import com.vouch.dispute.dto.*;
import com.vouch.dispute.entity.Dispute;
import com.vouch.dispute.repository.DisputeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DisputeService {

    private final DisputeRepository disputeRepository;
    private final AuthServiceClient authServiceClient;
    private final LoanServiceClient loanServiceClient;
    private final NotificationServiceClient notificationServiceClient;

    @Transactional
    public DisputeResponse openDispute(String phone, DisputeRequest request) {
        Map<String, Object> openerInfo = authServiceClient.getUserInfoByPhone(phone);
        Long openerId = ((Number) openerInfo.get("id")).longValue();
        String openerFirstName = (String) openerInfo.get("firstName");

        Map<String, Object> loan = loanServiceClient.getLoanDetails(request.getLoanId());
        Long borrowerId = ((Number) loan.get("borrowerId")).longValue();
        Long lenderId = loan.get("lenderId") != null ? ((Number) loan.get("lenderId")).longValue() : null;
        String status = (String) loan.get("status");
        Double amount = ((Number) loan.get("amount")).doubleValue();

        if (!openerId.equals(borrowerId) && (lenderId == null || !openerId.equals(lenderId))) {
            throw new RuntimeException("Only the borrower or lender can open a dispute");
        }

        if (!"ACTIVE".equals(status) && !"DUE".equals(status) && !"GRACE_PERIOD".equals(status) && !"REPAID".equals(status)) {
            throw new RuntimeException("Cannot dispute a loan in " + status + " status");
        }

        if (disputeRepository.existsByLoanIdAndStatusIn(request.getLoanId(),
                Arrays.asList(Dispute.DisputeStatus.OPEN, Dispute.DisputeStatus.UNDER_REVIEW))) {
            throw new RuntimeException("An active dispute already exists for this loan");
        }

        Dispute dispute = Dispute.builder()
                .loanId(request.getLoanId())
                .openedById(openerId)
                .reason(request.getReason())
                .evidence(request.getEvidence())
                .build();
        dispute = disputeRepository.save(dispute);

        loanServiceClient.setLoanDisputed(request.getLoanId());

        Long otherPartyId = openerId.equals(borrowerId) ? lenderId : borrowerId;
        if (otherPartyId != null) {
            notificationServiceClient.send(otherPartyId, "Dispute Opened",
                    openerFirstName + " opened a dispute on loan GHS " + amount,
                    "DISPUTE_OPENED", dispute.getId());
        }

        return mapToResponse(dispute, "Dispute opened. Admin will review.");
    }

    public List<DisputeResponse> getMyDisputes(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        return disputeRepository.findByOpenedById(userId).stream()
                .map(d -> mapToResponse(d, null)).collect(Collectors.toList());
    }

    public DisputeResponse getDispute(String phone, Long disputeId) {
        Map<String, Object> userInfo = authServiceClient.getUserInfoByPhone(phone);
        Long userId = ((Number) userInfo.get("id")).longValue();
        String role = (String) userInfo.get("role");

        Dispute dispute = disputeRepository.findById(disputeId)
                .orElseThrow(() -> new RuntimeException("Dispute not found"));

        Map<String, Object> loan = loanServiceClient.getLoanDetails(dispute.getLoanId());
        Long borrowerId = ((Number) loan.get("borrowerId")).longValue();
        Long lenderId = loan.get("lenderId") != null ? ((Number) loan.get("lenderId")).longValue() : null;

        if (!userId.equals(borrowerId) && (lenderId == null || !userId.equals(lenderId)) && !"ADMIN".equals(role)) {
            throw new RuntimeException("No access to this dispute");
        }

        return mapToResponse(dispute, null);
    }

    public List<DisputeResponse> getAllOpenDisputes(String phone) {
        String role = authServiceClient.getUserRole(phone);
        if (!"ADMIN".equals(role)) throw new RuntimeException("Only admins can view all disputes");
        return disputeRepository.findByStatus(Dispute.DisputeStatus.OPEN).stream()
                .map(d -> mapToResponse(d, null)).collect(Collectors.toList());
    }

    @Transactional
    public DisputeResponse resolveDispute(String phone, Long disputeId, DisputeResolveRequest request) {
        Map<String, Object> adminInfo = authServiceClient.getUserInfoByPhone(phone);
        String role = (String) adminInfo.get("role");
        Long adminId = ((Number) adminInfo.get("id")).longValue();
        if (!"ADMIN".equals(role)) throw new RuntimeException("Only admins can resolve disputes");

        Dispute dispute = disputeRepository.findById(disputeId)
                .orElseThrow(() -> new RuntimeException("Dispute not found"));
        if (dispute.getStatus() != Dispute.DisputeStatus.OPEN && dispute.getStatus() != Dispute.DisputeStatus.UNDER_REVIEW) {
            throw new RuntimeException("Already resolved");
        }

        Dispute.DisputeStatus outcome = request.getOutcome().equalsIgnoreCase("BORROWER_FAVOR")
                ? Dispute.DisputeStatus.RESOLVED_BORROWER_FAVOR
                : Dispute.DisputeStatus.RESOLVED_LENDER_FAVOR;

        dispute.setStatus(outcome);
        dispute.setResolution(request.getResolution());
        dispute.setAdminNotes(request.getAdminNotes());
        dispute.setResolvedById(adminId);
        dispute.setResolvedAt(LocalDateTime.now());
        disputeRepository.save(dispute);

        Map<String, Object> loan = loanServiceClient.getLoanDetails(dispute.getLoanId());
        Long borrowerId = ((Number) loan.get("borrowerId")).longValue();
        Long lenderId = loan.get("lenderId") != null ? ((Number) loan.get("lenderId")).longValue() : null;
        Double amount = ((Number) loan.get("amount")).doubleValue();

        notificationServiceClient.send(borrowerId, "Dispute Resolved",
                "Dispute on loan GHS " + amount + " resolved: " + outcome.name(),
                "DISPUTE_RESOLVED", dispute.getId());
        if (lenderId != null) {
            notificationServiceClient.send(lenderId, "Dispute Resolved",
                    "Dispute on loan GHS " + amount + " resolved: " + outcome.name(),
                    "DISPUTE_RESOLVED", dispute.getId());
        }

        return mapToResponse(dispute, "Dispute resolved.");
    }

    private DisputeResponse mapToResponse(Dispute d, String msg) {
        Map<String, Object> loan = loanServiceClient.getLoanDetails(d.getLoanId());
        Long borrowerId = ((Number) loan.get("borrowerId")).longValue();
        Long lenderId = loan.get("lenderId") != null ? ((Number) loan.get("lenderId")).longValue() : null;
        Double amount = ((Number) loan.get("amount")).doubleValue();

        String borrowerName = authServiceClient.getUserName(borrowerId);
        String lenderName = lenderId != null ? authServiceClient.getUserName(lenderId) : null;
        String openedByName = authServiceClient.getUserName(d.getOpenedById());
        String resolvedByName = d.getResolvedById() != null ? authServiceClient.getUserName(d.getResolvedById()) : null;

        return DisputeResponse.builder()
                .id(d.getId()).loanId(d.getLoanId()).loanAmount(amount)
                .borrowerName(borrowerName).lenderName(lenderName).openedByName(openedByName)
                .reason(d.getReason()).evidence(d.getEvidence()).status(d.getStatus().name())
                .adminNotes(d.getAdminNotes()).resolution(d.getResolution())
                .resolvedByName(resolvedByName).resolvedAt(d.getResolvedAt())
                .createdAt(d.getCreatedAt()).message(msg).build();
    }
}
