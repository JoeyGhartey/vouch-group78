package com.vouch.loan.service;

import com.vouch.loan.dto.*;
import com.vouch.loan.entity.*;
import com.vouch.loan.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CircleService {

    private final CircleRepository circleRepository;
    private final CircleMemberRepository circleMemberRepository;
    private final LoanRepository loanRepository;
    private final AuthServiceClient authServiceClient;
    private final NotificationServiceClient notificationServiceClient;

    public Map<String, Object> getCircleInsights(String phone, Long circleId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));
        validateMembership(circle, userId);

        List<Loan> allLoans = loanRepository.findByCircle(circle);
        int totalLoans = allLoans.size();
        long activeLoans = allLoans.stream().filter(l -> List.of(
                Loan.LoanStatus.ACTIVE, Loan.LoanStatus.DUE, Loan.LoanStatus.GRACE_PERIOD
        ).contains(l.getStatus())).count();
        long repaidLoans    = allLoans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.REPAID).count();
        long defaultedLoans = allLoans.stream().filter(l -> l.getStatus() == Loan.LoanStatus.DEFAULTED).count();
        double circleRepaymentRate = totalLoans == 0 ? 0.0
                : Math.round((double) repaidLoans / totalLoans * 1000.0) / 10.0;
        double totalAmountCirculated = allLoans.stream().mapToDouble(Loan::getAmount).sum();

        String circleHealth;
        if (totalLoans == 0)                 circleHealth = "New";
        else if (circleRepaymentRate >= 80)  circleHealth = "Excellent";
        else if (circleRepaymentRate >= 60)  circleHealth = "Good";
        else if (circleRepaymentRate >= 40)  circleHealth = "Fair";
        else                                 circleHealth = "Poor";

        List<CircleMember> activeMembers = circleMemberRepository
                .findByCircleAndStatus(circle, CircleMember.MemberStatus.ACTIVE);
        double averageTrustScore = activeMembers.isEmpty() ? 50.0
                : Math.round(activeMembers.stream()
                        .mapToDouble(CircleMember::getCircleTrustScore).average().orElse(50.0) * 10.0) / 10.0;

        CircleMember topLenderMember = activeMembers.stream()
                .filter(m -> m.getLoansGivenInCircle() > 0)
                .max(Comparator.comparingInt(CircleMember::getLoansGivenInCircle)).orElse(null);
        CircleMember topBorrowerMember = activeMembers.stream()
                .filter(m -> m.getLoansReceivedInCircle() > 0)
                .max(Comparator.comparingInt(CircleMember::getLoansReceivedInCircle)).orElse(null);
        String topLender   = topLenderMember   != null ? authServiceClient.getUserName(topLenderMember.getUserId())   : null;
        String topBorrower = topBorrowerMember != null ? authServiceClient.getUserName(topBorrowerMember.getUserId()) : null;

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("circleHealth",          circleHealth);
        result.put("totalLoans",            totalLoans);
        result.put("activeLoans",           activeLoans);
        result.put("repaidLoans",           repaidLoans);
        result.put("defaultedLoans",        defaultedLoans);
        result.put("circleRepaymentRate",   circleRepaymentRate);
        result.put("totalAmountCirculated", totalAmountCirculated);
        result.put("averageTrustScore",     averageTrustScore);
        if (topLender != null)   result.put("topLender",   topLender);
        if (topBorrower != null) result.put("topBorrower", topBorrower);
        return result;
    }

    @Transactional
    public CircleResponse createCircle(String phone, CreateCircleRequest request) {
        Long creatorId = authServiceClient.getUserIdByPhone(phone);
        Circle circle = Circle.builder().name(request.getName()).description(request.getDescription()).creatorId(creatorId)
                .maxLoanAmount(request.getMaxLoanAmount() != null ? request.getMaxLoanAmount() : 5000.0)
                .groupFundingThreshold(request.getGroupFundingThreshold() != null ? request.getGroupFundingThreshold() : 3000.0)
                .minTrustScore(request.getMinTrustScore() != null ? request.getMinTrustScore() : 0.0)
                .requireApprovalToJoin(request.getRequireApprovalToJoin() != null ? request.getRequireApprovalToJoin() : true).build();
        circle = circleRepository.save(circle);
        CircleMember cm = CircleMember.builder().circle(circle).userId(creatorId).status(CircleMember.MemberStatus.ACTIVE).memberRole(CircleMember.MemberRole.CREATOR).build();
        circleMemberRepository.save(cm);
        return mapToCircleResponse(circle);
    }

    public List<CircleResponse> getMyCircles(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        return circleMemberRepository.findByUserIdAndStatus(userId, CircleMember.MemberStatus.ACTIVE)
                .stream().map(m -> mapToCircleResponse(m.getCircle())).collect(Collectors.toList());
    }

    public List<CircleResponse> getPendingInvites(String phone) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        return circleMemberRepository.findByUserIdAndStatus(userId, CircleMember.MemberStatus.PENDING)
                .stream().map(m -> mapToCircleResponse(m.getCircle())).collect(Collectors.toList());
    }

    public CircleResponse getCircle(String phone, Long circleId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Circle circle = circleRepository.findById(circleId).orElseThrow(() -> new RuntimeException("Circle not found"));
        validateMembership(circle, userId);
        return mapToCircleResponse(circle);
    }

    @Transactional
    public CircleResponse updateCircle(String phone, Long circleId, UpdateCircleRequest request) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Circle circle = circleRepository.findById(circleId).orElseThrow(() -> new RuntimeException("Circle not found"));
        CircleMember member = circleMemberRepository.findByCircleAndUserId(circle, userId).orElseThrow(() -> new RuntimeException("Not a member"));
        if (member.getMemberRole() != CircleMember.MemberRole.CREATOR) throw new RuntimeException("Only creator can update");
        if (request.getName() != null && !request.getName().isBlank()) circle.setName(request.getName());
        if (request.getDescription() != null) circle.setDescription(request.getDescription());
        if (request.getMaxLoanAmount() != null) circle.setMaxLoanAmount(request.getMaxLoanAmount());
        if (request.getGroupFundingThreshold() != null) circle.setGroupFundingThreshold(request.getGroupFundingThreshold());
        if (request.getMinTrustScore() != null) circle.setMinTrustScore(request.getMinTrustScore());
        if (request.getRequireApprovalToJoin() != null) circle.setRequireApprovalToJoin(request.getRequireApprovalToJoin());
        return mapToCircleResponse(circleRepository.save(circle));
    }

    @Transactional
    public String inviteMember(String phone, Long circleId, String inviteePhone) {
        Long inviterId = authServiceClient.getUserIdByPhone(phone);
        Circle circle = circleRepository.findById(circleId).orElseThrow(() -> new RuntimeException("Circle not found"));
        validateMembership(circle, inviterId);

        Map<String, Object> inviteeInfo = authServiceClient.getUserInfoByPhone(inviteePhone);
        Long inviteeId = ((Number) inviteeInfo.get("id")).longValue();
        Double trustScore = ((Number) inviteeInfo.get("trustScore")).doubleValue();

        if (circleMemberRepository.existsByCircleAndUserId(circle, inviteeId)) throw new RuntimeException("Already a member or invited");
        if (trustScore < circle.getMinTrustScore()) throw new RuntimeException("Trust score too low");
        List<CircleMember> active = circleMemberRepository.findByCircleAndStatus(circle, CircleMember.MemberStatus.ACTIVE);
        if (active.size() >= 15) throw new RuntimeException("Circle full (max 15)");

        CircleMember.MemberStatus status = circle.getRequireApprovalToJoin() ? CircleMember.MemberStatus.PENDING : CircleMember.MemberStatus.ACTIVE;
        circleMemberRepository.save(CircleMember.builder().circle(circle).userId(inviteeId).status(status).memberRole(CircleMember.MemberRole.MEMBER).build());

        String inviterName = authServiceClient.getUserFirstName(inviterId);
        notificationServiceClient.send(inviteeId, "Circle Invitation",
                inviterName + " invited you to \"" + circle.getName() + "\"",
                "CIRCLE_INVITE", circle.getId());
        return status == CircleMember.MemberStatus.ACTIVE ? "Member added" : "Invitation sent, pending approval";
    }

    @Transactional
    public String approveMember(String phone, Long circleId, Long memberId) {
        Long approverId = authServiceClient.getUserIdByPhone(phone);
        Circle circle = circleRepository.findById(circleId).orElseThrow(() -> new RuntimeException("Circle not found"));
        CircleMember am = circleMemberRepository.findByCircleAndUserId(circle, approverId).orElseThrow(() -> new RuntimeException("Not a member"));
        if (am.getMemberRole() != CircleMember.MemberRole.CREATOR && am.getMemberRole() != CircleMember.MemberRole.ADMIN) throw new RuntimeException("No permission");
        CircleMember pm = circleMemberRepository.findById(memberId).orElseThrow(() -> new RuntimeException("Member not found"));
        if (pm.getStatus() != CircleMember.MemberStatus.PENDING) throw new RuntimeException("Not pending");
        pm.setStatus(CircleMember.MemberStatus.ACTIVE);
        circleMemberRepository.save(pm);
        notificationServiceClient.send(pm.getUserId(), "Approved",
                "You've been approved to join \"" + circle.getName() + "\"",
                "CIRCLE_MEMBER_APPROVED", circle.getId());
        return "Member approved";
    }

    @Transactional
    public String acceptInvite(String phone, Long circleId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));
        CircleMember member = circleMemberRepository.findByCircleAndUserId(circle, userId)
                .orElseThrow(() -> new RuntimeException("No pending invite found"));
        if (member.getStatus() != CircleMember.MemberStatus.PENDING) {
            throw new RuntimeException("No pending invite found");
        }
        member.setStatus(CircleMember.MemberStatus.ACTIVE);
        circleMemberRepository.save(member);

        String userName = authServiceClient.getUserFirstName(userId);
        notificationServiceClient.send(circle.getCreatorId(), "Member Joined",
                userName + " accepted the invite to \"" + circle.getName() + "\"",
                "CIRCLE_MEMBER_APPROVED", circle.getId());
        return "You have joined \"" + circle.getName() + "\"";
    }

    @Transactional
    public String rejectInvite(String phone, Long circleId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));
        CircleMember member = circleMemberRepository.findByCircleAndUserId(circle, userId)
                .orElseThrow(() -> new RuntimeException("No pending invite found"));
        if (member.getStatus() != CircleMember.MemberStatus.PENDING) {
            throw new RuntimeException("No pending invite found");
        }
        member.setStatus(CircleMember.MemberStatus.REMOVED);
        circleMemberRepository.save(member);
        return "Invite rejected";
    }

    @Transactional
    public String removeMember(String phone, Long circleId, Long targetUserId) {
        Long removerId = authServiceClient.getUserIdByPhone(phone);
        Circle circle = circleRepository.findById(circleId).orElseThrow(() -> new RuntimeException("Circle not found"));
        CircleMember rm = circleMemberRepository.findByCircleAndUserId(circle, removerId).orElseThrow(() -> new RuntimeException("Not a member"));
        if (rm.getMemberRole() != CircleMember.MemberRole.CREATOR) throw new RuntimeException("Only creator can remove");
        CircleMember tm = circleMemberRepository.findByCircleAndUserId(circle, targetUserId).orElseThrow(() -> new RuntimeException("Not a member"));
        tm.setStatus(CircleMember.MemberStatus.REMOVED);
        circleMemberRepository.save(tm);
        notificationServiceClient.send(targetUserId, "Removed",
                "You were removed from \"" + circle.getName() + "\"",
                "CIRCLE_MEMBER_REMOVED", circle.getId());
        return "Member removed";
    }

    @Transactional
    public String leaveCircle(String phone, Long circleId) {
        Long userId = authServiceClient.getUserIdByPhone(phone);
        Circle circle = circleRepository.findById(circleId).orElseThrow(() -> new RuntimeException("Circle not found"));
        CircleMember member = circleMemberRepository.findByCircleAndUserId(circle, userId).orElseThrow(() -> new RuntimeException("Not a member"));
        if (member.getMemberRole() == CircleMember.MemberRole.CREATOR) throw new RuntimeException("Creator cannot leave");
        member.setStatus(CircleMember.MemberStatus.REMOVED);
        circleMemberRepository.save(member);
        return "You have left the circle";
    }

    public void validateMembership(Circle circle, Long userId) {
        CircleMember m = circleMemberRepository.findByCircleAndUserId(circle, userId).orElseThrow(() -> new RuntimeException("Not a member"));
        if (m.getStatus() != CircleMember.MemberStatus.ACTIVE) throw new RuntimeException("Membership not active");
    }

    private CircleResponse mapToCircleResponse(Circle circle) {
        List<CircleMember> active = circleMemberRepository.findByCircleAndStatus(circle, CircleMember.MemberStatus.ACTIVE);
        List<CircleMemberResponse> members = active.stream().map(m -> {
            Map<String, Object> userInfo = authServiceClient.getUserInfo(m.getUserId());
            return CircleMemberResponse.builder()
                    .userId(m.getUserId())
                    .firstName((String) userInfo.get("firstName"))
                    .lastName((String) userInfo.get("lastName"))
                    .phone((String) userInfo.get("phone"))
                    .status(m.getStatus().name()).memberRole(m.getMemberRole().name())
                    .circleTrustScore(m.getCircleTrustScore()).loansGivenInCircle(m.getLoansGivenInCircle())
                    .loansReceivedInCircle(m.getLoansReceivedInCircle()).loansRepaidInCircle(m.getLoansRepaidInCircle())
                    .defaultsInCircle(m.getDefaultsInCircle()).build();
        }).collect(Collectors.toList());
        String creatorName = authServiceClient.getUserName(circle.getCreatorId());
        return CircleResponse.builder().id(circle.getId()).name(circle.getName()).description(circle.getDescription())
                .creatorName(creatorName).creatorId(circle.getCreatorId()).maxLoanAmount(circle.getMaxLoanAmount())
                .groupFundingThreshold(circle.getGroupFundingThreshold()).minTrustScore(circle.getMinTrustScore())
                .requireApprovalToJoin(circle.getRequireApprovalToJoin()).memberCount(active.size())
                .members(members).createdAt(circle.getCreatedAt()).build();
    }
}
