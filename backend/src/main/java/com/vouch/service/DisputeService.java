package com.vouch.service;

import com.vouch.dto.*;
import com.vouch.entity.*;
import com.vouch.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
@Service
@RequiredArgsConstructor
public class DisputeService {

    private final DisputeRepository disputeRepository;
    private final LoanRepository loanRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional
    public DisputeResponse openDispute(String phone, DisputeRequest request) {
        User opener = getUserByPhone(phone);
        Loan loan = loanRepository.findById(request.getLoanId()).orElseThrow(() -> new RuntimeException("Loan not found"));

        if (!opener.getId().equals(loan.getBorrower().getId()) && (loan.getLender() == null || !opener.getId().equals(loan.getLender().getId())))
            throw new RuntimeException("Only the borrower or lender can open a dispute");

        if (loan.getStatus() != Loan.LoanStatus.ACTIVE && loan.getStatus() != Loan.LoanStatus.DUE && loan.getStatus() != Loan.LoanStatus.GRACE_PERIOD && loan.getStatus() != Loan.LoanStatus.REPAID)
            throw new RuntimeException("Cannot dispute a loan in " + loan.getStatus() + " status");

        if (disputeRepository.existsByLoanAndStatusIn(loan, Arrays.asList(Dispute.DisputeStatus.OPEN, Dispute.DisputeStatus.UNDER_REVIEW)))
            throw new RuntimeException("An active dispute already exists for this loan");

        Dispute dispute = Dispute.builder().loan(loan).openedBy(opener).reason(request.getReason()).evidence(request.getEvidence()).build();
        dispute = disputeRepository.save(dispute);

        loan.setStatus(Loan.LoanStatus.DISPUTED);
        loanRepository.save(loan);

        User otherParty = opener.getId().equals(loan.getBorrower().getId()) ? loan.getLender() : loan.getBorrower();
        if (otherParty != null) notificationService.send(otherParty, "Dispute Opened", opener.getFirstName() + " opened a dispute on loan GHS " + loan.getAmount(), Notification.NotificationType.DISPUTE_OPENED, dispute.getId());
        String adminMsg = opener.getFirstName() + " opened a dispute on loan GHS " + loan.getAmount() + ". Review required.";
        Long savedDisputeId = dispute.getId();
        userRepository.findAll().stream()
            .filter(u -> u.getRole() == User.Role.ADMIN)
            .forEach(admin -> notificationService.send(admin, "New Dispute", adminMsg, Notification.NotificationType.DISPUTE_OPENED, savedDisputeId));

        return mapToResponse(dispute, "Dispute opened. Admin will review.");
    }

    public List<DisputeResponse> getMyDisputes(String phone) {
        return disputeRepository.findByOpenedBy(getUserByPhone(phone)).stream().map(d -> mapToResponse(d, null)).collect(Collectors.toList());
    }

    public DisputeResponse getDispute(String phone, Long disputeId) {
        User user = getUserByPhone(phone);
        Dispute dispute = disputeRepository.findById(disputeId).orElseThrow(() -> new RuntimeException("Dispute not found"));
        Loan loan = dispute.getLoan();
        if (!user.getId().equals(loan.getBorrower().getId()) && (loan.getLender() == null || !user.getId().equals(loan.getLender().getId())) && user.getRole() != User.Role.ADMIN)
            throw new RuntimeException("No access to this dispute");
        return mapToResponse(dispute, null);
    }

    public List<DisputeResponse> getAllOpenDisputes(String phone) {
        User admin = getUserByPhone(phone);
        if (admin.getRole() != User.Role.ADMIN) throw new RuntimeException("Only admins can view all disputes");
        return disputeRepository.findByStatus(Dispute.DisputeStatus.OPEN).stream().map(d -> mapToResponse(d, null)).collect(Collectors.toList());
    }

    @Transactional
    public DisputeResponse resolveDispute(String phone, Long disputeId, DisputeResolveRequest request) {
        User admin = getUserByPhone(phone);
        if (admin.getRole() != User.Role.ADMIN) throw new RuntimeException("Only admins can resolve disputes");

        Dispute dispute = disputeRepository.findById(disputeId).orElseThrow(() -> new RuntimeException("Dispute not found"));
        if (dispute.getStatus() != Dispute.DisputeStatus.OPEN && dispute.getStatus() != Dispute.DisputeStatus.UNDER_REVIEW)
            throw new RuntimeException("Already resolved");

        Dispute.DisputeStatus outcome = request.getOutcome().equalsIgnoreCase("BORROWER_FAVOR") ? Dispute.DisputeStatus.RESOLVED_BORROWER_FAVOR : Dispute.DisputeStatus.RESOLVED_LENDER_FAVOR;

        dispute.setStatus(outcome); dispute.setResolution(request.getResolution()); dispute.setAdminNotes(request.getAdminNotes());
        dispute.setResolvedBy(admin); dispute.setResolvedAt(LocalDateTime.now());
        disputeRepository.save(dispute);

        Loan loan = dispute.getLoan();
        notificationService.send(loan.getBorrower(), "Dispute Resolved", "Dispute on loan GHS " + loan.getAmount() + " resolved.", Notification.NotificationType.DISPUTE_RESOLVED, dispute.getId());
        if (loan.getLender() != null) notificationService.send(loan.getLender(), "Dispute Resolved", "Dispute on loan GHS " + loan.getAmount() + " resolved.", Notification.NotificationType.DISPUTE_RESOLVED, dispute.getId());

        return mapToResponse(dispute, "Dispute resolved.");
    }

    private User getUserByPhone(String phone) { return userRepository.findByPhone(phone).orElseThrow(() -> new RuntimeException("User not found")); }

    private DisputeResponse mapToResponse(Dispute d, String msg) {
        Loan loan = d.getLoan();
        return DisputeResponse.builder().id(d.getId()).loanId(loan.getId()).loanAmount(loan.getAmount())
                .borrowerName(loan.getBorrower().getFirstName() + " " + loan.getBorrower().getLastName())
                .lenderName(loan.getLender() != null ? loan.getLender().getFirstName() + " " + loan.getLender().getLastName() : null)
                .openedByName(d.getOpenedBy().getFirstName() + " " + d.getOpenedBy().getLastName())
                .reason(d.getReason()).evidence(d.getEvidence()).status(d.getStatus().name())
                .adminNotes(d.getAdminNotes()).resolution(d.getResolution())
                .resolvedByName(d.getResolvedBy() != null ? d.getResolvedBy().getFirstName() + " " + d.getResolvedBy().getLastName() : null)
                .resolvedAt(d.getResolvedAt()).createdAt(d.getCreatedAt()).message(msg).build();
    }
}
