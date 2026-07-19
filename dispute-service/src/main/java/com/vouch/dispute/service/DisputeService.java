package com.vouch.dispute.service;

import com.vouch.dispute.dto.*;
import com.vouch.dispute.entity.Dispute;
import com.vouch.dispute.repository.DisputeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DisputeService {

    private final DisputeRepository disputeRepository;
    private final AuthServiceClient authServiceClient;
    private final LoanServiceClient loanServiceClient;
    private final CircleServiceClient circleServiceClient;
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
        return mapAllToResponses(disputeRepository.findByOpenedById(userId));
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
        return mapAllToResponses(disputeRepository.findByStatus(Dispute.DisputeStatus.OPEN));
    }

    // Circle owners resolve disputes within their own circle first; the global
    // ADMIN role (getAllOpenDisputes above) is only the escalation path for
    // cases a circle owner can't or won't settle.
    public List<DisputeResponse> getCircleDisputes(String phone, Long circleId) {
        Map<String, Object> requesterInfo = authServiceClient.getUserInfoByPhone(phone);
        Long requesterId = ((Number) requesterInfo.get("id")).longValue();
        String role = (String) requesterInfo.get("role");

        Map<String, Object> circleInfo = circleServiceClient.getCircleInfo(circleId);
        Long creatorId = ((Number) circleInfo.get("creatorId")).longValue();
        if (!requesterId.equals(creatorId) && !"ADMIN".equals(role)) {
            throw new RuntimeException("Only the circle owner can view this circle's disputes");
        }

        List<Dispute> openDisputes = disputeRepository.findByStatus(Dispute.DisputeStatus.OPEN);
        List<Dispute> scoped = openDisputes.stream()
                .filter(d -> {
                    Map<String, Object> loan = loanServiceClient.getLoanDetails(d.getLoanId());
                    Long loanCircleId = ((Number) loan.get("circleId")).longValue();
                    return loanCircleId.equals(circleId);
                })
                .collect(Collectors.toList());
        return mapAllToResponses(scoped);
    }

    @Transactional
    public DisputeResponse resolveDispute(String phone, Long disputeId, DisputeResolveRequest request) {
        Map<String, Object> resolverInfo = authServiceClient.getUserInfoByPhone(phone);
        String role = (String) resolverInfo.get("role");
        Long resolverId = ((Number) resolverInfo.get("id")).longValue();

        Dispute dispute = disputeRepository.findById(disputeId)
                .orElseThrow(() -> new RuntimeException("Dispute not found"));
        if (dispute.getStatus() != Dispute.DisputeStatus.OPEN && dispute.getStatus() != Dispute.DisputeStatus.UNDER_REVIEW) {
            throw new RuntimeException("Already resolved");
        }

        // A circle owner may resolve disputes on loans within their own circle;
        // the global ADMIN role may resolve any dispute (escalation / fallback).
        // Once a dispute has been escalated (manually by a party, or automatically
        // after the timeout), the circle owner is locked out — only a platform
        // admin can resolve it from that point on.
        if (!"ADMIN".equals(role)) {
            if (Boolean.TRUE.equals(dispute.getEscalated())) {
                throw new RuntimeException("This dispute has been escalated to a platform admin and can no longer be resolved by the circle owner");
            }
            Map<String, Object> loan = loanServiceClient.getLoanDetails(dispute.getLoanId());
            Long circleId = ((Number) loan.get("circleId")).longValue();
            Map<String, Object> circleInfo = circleServiceClient.getCircleInfo(circleId);
            Long creatorId = ((Number) circleInfo.get("creatorId")).longValue();
            if (!resolverId.equals(creatorId)) {
                throw new RuntimeException("Only the circle owner or a platform admin can resolve this dispute");
            }
        }

        Dispute.DisputeStatus outcome = request.getOutcome().equalsIgnoreCase("BORROWER_FAVOR")
                ? Dispute.DisputeStatus.RESOLVED_BORROWER_FAVOR
                : Dispute.DisputeStatus.RESOLVED_LENDER_FAVOR;

        dispute.setStatus(outcome);
        dispute.setResolution(request.getResolution());
        dispute.setAdminNotes(request.getAdminNotes());
        dispute.setResolvedById(resolverId);
        dispute.setResolvedAt(LocalDateTime.now());
        disputeRepository.save(dispute);

        // Restore the loan out of DISPUTED now that a resolution is recorded --
        // without this it stays permanently stuck and can never be repaid/progressed.
        loanServiceClient.resolveLoanDispute(dispute.getLoanId());

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

    public DisputeResponse getDisputeByLoanId(String phone, Long loanId) {
        Map<String, Object> userInfo = authServiceClient.getUserInfoByPhone(phone);
        Long userId = ((Number) userInfo.get("id")).longValue();
        String role = (String) userInfo.get("role");

        Dispute dispute = disputeRepository.findByLoanId(loanId)
                .orElseThrow(() -> new RuntimeException("No dispute found for this loan"));

        Map<String, Object> loan = loanServiceClient.getLoanDetails(loanId);
        Long borrowerId = ((Number) loan.get("borrowerId")).longValue();
        Long lenderId = loan.get("lenderId") != null ? ((Number) loan.get("lenderId")).longValue() : null;

        if (!userId.equals(borrowerId) && (lenderId == null || !userId.equals(lenderId)) && !"ADMIN".equals(role)) {
            throw new RuntimeException("No access to this dispute");
        }

        return mapToResponse(dispute, null);
    }

    // A party to the dispute (borrower or lender — not the circle owner, since
    // the whole point is to bypass them) can manually escalate straight to a
    // platform admin instead of waiting on the circle owner or the auto-escalation
    // timeout below.
    @Transactional
    public DisputeResponse escalateDispute(String phone, Long disputeId) {
        Map<String, Object> requesterInfo = authServiceClient.getUserInfoByPhone(phone);
        Long requesterId = ((Number) requesterInfo.get("id")).longValue();

        Dispute dispute = disputeRepository.findById(disputeId)
                .orElseThrow(() -> new RuntimeException("Dispute not found"));
        if (dispute.getStatus() != Dispute.DisputeStatus.OPEN && dispute.getStatus() != Dispute.DisputeStatus.UNDER_REVIEW) {
            throw new RuntimeException("This dispute has already been resolved");
        }
        if (Boolean.TRUE.equals(dispute.getEscalated())) {
            throw new RuntimeException("This dispute has already been escalated");
        }

        Map<String, Object> loan = loanServiceClient.getLoanDetails(dispute.getLoanId());
        Long borrowerId = ((Number) loan.get("borrowerId")).longValue();
        Long lenderId = loan.get("lenderId") != null ? ((Number) loan.get("lenderId")).longValue() : null;
        if (!requesterId.equals(borrowerId) && (lenderId == null || !requesterId.equals(lenderId))) {
            throw new RuntimeException("Only the borrower or lender on this loan can escalate it");
        }

        dispute.setEscalated(true);
        dispute.setEscalatedAt(LocalDateTime.now());
        dispute.setEscalatedById(requesterId);
        disputeRepository.save(dispute);

        notifyEscalation(dispute, loan, borrowerId, lenderId, requesterId);

        return mapToResponse(dispute, "Escalated to a platform admin.");
    }

    // Safety net for when nobody escalates manually and the circle owner just
    // never acts: after 72 hours with no resolution, escalate automatically so
    // a dispute can't sit open forever.
    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void autoEscalateStaleDisputes() {
        List<Dispute> candidates = disputeRepository.findByStatusInAndEscalatedFalse(
                Arrays.asList(Dispute.DisputeStatus.OPEN, Dispute.DisputeStatus.UNDER_REVIEW));
        LocalDateTime cutoff = LocalDateTime.now().minusHours(72);
        for (Dispute dispute : candidates) {
            if (dispute.getCreatedAt() == null || dispute.getCreatedAt().isAfter(cutoff)) continue;
            try {
                Map<String, Object> loan = loanServiceClient.getLoanDetails(dispute.getLoanId());
                Long borrowerId = ((Number) loan.get("borrowerId")).longValue();
                Long lenderId = loan.get("lenderId") != null ? ((Number) loan.get("lenderId")).longValue() : null;

                dispute.setEscalated(true);
                dispute.setEscalatedAt(LocalDateTime.now());
                dispute.setEscalatedById(null);
                disputeRepository.save(dispute);

                notifyEscalation(dispute, loan, borrowerId, lenderId, null);
            } catch (Exception e) {
                log.warn("Failed to auto-escalate dispute {}: {}", dispute.getId(), e.getMessage());
            }
        }
    }

    private void notifyEscalation(Dispute dispute, Map<String, Object> loan, Long borrowerId, Long lenderId, Long escalatedByUserId) {
        Double amount = ((Number) loan.get("amount")).doubleValue();
        String reasonSuffix = escalatedByUserId == null
                ? " after 3 days without resolution."
                : ".";
        String message = "Dispute on loan GHS " + amount + " has been escalated to a Vouch platform admin" + reasonSuffix;

        notificationServiceClient.send(borrowerId, "Dispute Escalated", message, "DISPUTE_ESCALATED", dispute.getId());
        if (lenderId != null) {
            notificationServiceClient.send(lenderId, "Dispute Escalated", message, "DISPUTE_ESCALATED", dispute.getId());
        }

        try {
            Long circleId = ((Number) loan.get("circleId")).longValue();
            Map<String, Object> circleInfo = circleServiceClient.getCircleInfo(circleId);
            Long circleOwnerId = ((Number) circleInfo.get("creatorId")).longValue();
            notificationServiceClient.send(circleOwnerId, "Dispute Escalated Past You",
                    "A dispute in \"" + circleInfo.get("name") + "\" has been escalated to a Vouch platform admin" + reasonSuffix,
                    "DISPUTE_ESCALATED", dispute.getId());
        } catch (Exception e) {
            log.warn("Failed to notify circle owner of escalation for dispute {}: {}", dispute.getId(), e.getMessage());
        }

        for (Long adminId : authServiceClient.getAdminUserIds()) {
            notificationServiceClient.send(adminId, "Dispute Needs Review",
                    "A dispute on loan GHS " + amount + " has been escalated and needs platform review.",
                    "DISPUTE_ESCALATED", dispute.getId());
        }
    }

    private List<DisputeResponse> mapAllToResponses(List<Dispute> disputes) {
        Map<Long, Map<String, Object>> loansById = new java.util.HashMap<>();
        java.util.Set<Long> userIds = new java.util.HashSet<>();
        for (Dispute d : disputes) {
            Map<String, Object> loan = loansById.computeIfAbsent(d.getLoanId(), loanServiceClient::getLoanDetails);
            if (loan.get("borrowerId") != null) userIds.add(((Number) loan.get("borrowerId")).longValue());
            if (loan.get("lenderId") != null) userIds.add(((Number) loan.get("lenderId")).longValue());
            userIds.add(d.getOpenedById());
            if (d.getResolvedById() != null) userIds.add(d.getResolvedById());
        }
        Map<Long, Map<String, Object>> users = authServiceClient.getUsersInfo(userIds);
        return disputes.stream()
                .map(d -> mapToResponse(d, null, loansById.get(d.getLoanId()), users))
                .collect(Collectors.toList());
    }

    private DisputeResponse mapToResponse(Dispute d, String msg) {
        Map<String, Object> loan = loanServiceClient.getLoanDetails(d.getLoanId());
        java.util.Set<Long> userIds = new java.util.HashSet<>();
        if (loan.get("borrowerId") != null) userIds.add(((Number) loan.get("borrowerId")).longValue());
        if (loan.get("lenderId") != null) userIds.add(((Number) loan.get("lenderId")).longValue());
        userIds.add(d.getOpenedById());
        if (d.getResolvedById() != null) userIds.add(d.getResolvedById());
        return mapToResponse(d, msg, loan, authServiceClient.getUsersInfo(userIds));
    }

    private DisputeResponse mapToResponse(Dispute d, String msg, Map<String, Object> loan, Map<Long, Map<String, Object>> users) {
        Long borrowerId = ((Number) loan.get("borrowerId")).longValue();
        Long lenderId = loan.get("lenderId") != null ? ((Number) loan.get("lenderId")).longValue() : null;
        Double amount = ((Number) loan.get("amount")).doubleValue();

        String borrowerName = AuthServiceClient.nameOf(users.get(borrowerId));
        String lenderName = lenderId != null ? AuthServiceClient.nameOf(users.get(lenderId)) : null;
        String openedByName = AuthServiceClient.nameOf(users.get(d.getOpenedById()));
        String resolvedByName = d.getResolvedById() != null ? AuthServiceClient.nameOf(users.get(d.getResolvedById())) : null;

        return DisputeResponse.builder()
                .id(d.getId()).loanId(d.getLoanId()).loanAmount(amount)
                .borrowerName(borrowerName).lenderName(lenderName).openedByName(openedByName)
                .reason(d.getReason()).evidence(d.getEvidence()).status(d.getStatus().name())
                .adminNotes(d.getAdminNotes()).resolution(d.getResolution())
                .resolvedByName(resolvedByName).resolvedAt(d.getResolvedAt())
                .escalated(d.getEscalated()).escalatedAt(d.getEscalatedAt())
                .createdAt(d.getCreatedAt()).message(msg).build();
    }
}
