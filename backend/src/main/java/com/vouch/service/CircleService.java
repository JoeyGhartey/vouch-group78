package com.vouch.service;

import com.vouch.dto.*;
import com.vouch.entity.*;
import com.vouch.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CircleService {

    private final CircleRepository circleRepository;
    private final CircleMemberRepository circleMemberRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional
    public CircleResponse createCircle(String phone, CreateCircleRequest request) {
        User creator = getUserByPhone(phone);
        Circle circle = Circle.builder().name(request.getName()).description(request.getDescription()).creator(creator)
                .maxLoanAmount(request.getMaxLoanAmount() != null ? request.getMaxLoanAmount() : 5000.0)
                .groupFundingThreshold(request.getGroupFundingThreshold() != null ? request.getGroupFundingThreshold() : 3000.0)
                .minTrustScore(request.getMinTrustScore() != null ? request.getMinTrustScore() : 0.0)
                .requireApprovalToJoin(request.getRequireApprovalToJoin() != null ? request.getRequireApprovalToJoin() : true).build();
        circle = circleRepository.save(circle);
        CircleMember cm = CircleMember.builder().circle(circle).user(creator).status(CircleMember.MemberStatus.ACTIVE).memberRole(CircleMember.MemberRole.CREATOR).build();
        circleMemberRepository.save(cm);
        return mapToCircleResponse(circle);
    }

    public List<CircleResponse> getMyCircles(String phone) {
        User user = getUserByPhone(phone);
        return circleMemberRepository.findByUserAndStatus(user, CircleMember.MemberStatus.ACTIVE).stream().map(m -> mapToCircleResponse(m.getCircle())).collect(Collectors.toList());
    }

    public CircleResponse getCircle(String phone, Long circleId) {
        User user = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId).orElseThrow(() -> new RuntimeException("Circle not found"));
        validateMembership(circle, user);
        return mapToCircleResponse(circle);
    }

    @Transactional
    public CircleResponse updateCircle(String phone, Long circleId, UpdateCircleRequest request) {
        User user = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId).orElseThrow(() -> new RuntimeException("Circle not found"));
        CircleMember member = circleMemberRepository.findByCircleAndUser(circle, user).orElseThrow(() -> new RuntimeException("Not a member"));
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
        User inviter = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId).orElseThrow(() -> new RuntimeException("Circle not found"));
        validateMembership(circle, inviter);
        User invitee = userRepository.findByPhone(inviteePhone).orElseThrow(() -> new RuntimeException("User not found: " + inviteePhone));
        if (circleMemberRepository.existsByCircleAndUser(circle, invitee)) throw new RuntimeException("Already a member or invited");
        if (invitee.getTrustScore() < circle.getMinTrustScore()) throw new RuntimeException("Trust score too low");
        List<CircleMember> active = circleMemberRepository.findByCircleAndStatus(circle, CircleMember.MemberStatus.ACTIVE);
        if (active.size() >= 15) throw new RuntimeException("Circle full (max 15)");

        CircleMember.MemberStatus status = circle.getRequireApprovalToJoin() ? CircleMember.MemberStatus.PENDING : CircleMember.MemberStatus.ACTIVE;
        circleMemberRepository.save(CircleMember.builder().circle(circle).user(invitee).status(status).memberRole(CircleMember.MemberRole.MEMBER).build());
        notificationService.send(invitee, "Circle Invitation", inviter.getFirstName() + " invited you to \"" + circle.getName() + "\"", Notification.NotificationType.CIRCLE_INVITE, circle.getId());
        return status == CircleMember.MemberStatus.ACTIVE ? "Member added" : "Invitation sent, pending approval";
    }

    @Transactional
    public String approveMember(String phone, Long circleId, Long memberId) {
        User approver = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId).orElseThrow(() -> new RuntimeException("Circle not found"));
        CircleMember am = circleMemberRepository.findByCircleAndUser(circle, approver).orElseThrow(() -> new RuntimeException("Not a member"));
        if (am.getMemberRole() != CircleMember.MemberRole.CREATOR && am.getMemberRole() != CircleMember.MemberRole.ADMIN) throw new RuntimeException("No permission");
        CircleMember pm = circleMemberRepository.findById(memberId).orElseThrow(() -> new RuntimeException("Member not found"));
        if (pm.getStatus() != CircleMember.MemberStatus.PENDING) throw new RuntimeException("Not pending");
        pm.setStatus(CircleMember.MemberStatus.ACTIVE);
        circleMemberRepository.save(pm);
        notificationService.send(pm.getUser(), "Approved", "You've been approved to join \"" + circle.getName() + "\"", Notification.NotificationType.CIRCLE_MEMBER_APPROVED, circle.getId());
        return "Member approved";
    }

    @Transactional
    public String removeMember(String phone, Long circleId, Long userId) {
        User remover = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId).orElseThrow(() -> new RuntimeException("Circle not found"));
        CircleMember rm = circleMemberRepository.findByCircleAndUser(circle, remover).orElseThrow(() -> new RuntimeException("Not a member"));
        if (rm.getMemberRole() != CircleMember.MemberRole.CREATOR) throw new RuntimeException("Only creator can remove");
        User target = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
        CircleMember tm = circleMemberRepository.findByCircleAndUser(circle, target).orElseThrow(() -> new RuntimeException("Not a member"));
        tm.setStatus(CircleMember.MemberStatus.REMOVED);
        circleMemberRepository.save(tm);
        notificationService.send(target, "Removed", "You were removed from \"" + circle.getName() + "\"", Notification.NotificationType.CIRCLE_MEMBER_REMOVED, circle.getId());
        return "Member removed";
    }

    @Transactional
    public String leaveCircle(String phone, Long circleId) {
        User user = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId).orElseThrow(() -> new RuntimeException("Circle not found"));
        CircleMember member = circleMemberRepository.findByCircleAndUser(circle, user).orElseThrow(() -> new RuntimeException("Not a member"));
        if (member.getMemberRole() == CircleMember.MemberRole.CREATOR) throw new RuntimeException("Creator cannot leave");
        member.setStatus(CircleMember.MemberStatus.REMOVED);
        circleMemberRepository.save(member);
        return "You have left the circle";
    }

    public void validateMembership(Circle circle, User user) {
        CircleMember m = circleMemberRepository.findByCircleAndUser(circle, user).orElseThrow(() -> new RuntimeException("Not a member"));
        if (m.getStatus() != CircleMember.MemberStatus.ACTIVE) throw new RuntimeException("Membership not active");
    }

    public void updateCircleTrustScore(Circle circle, User user, boolean positive) {
        CircleMember m = circleMemberRepository.findByCircleAndUser(circle, user).orElse(null);
        if (m != null) { m.setCircleTrustScore(Math.max(0, Math.min(100, m.getCircleTrustScore() + (positive ? 1.5 : -8.0)))); circleMemberRepository.save(m); }
    }

    private User getUserByPhone(String phone) { return userRepository.findByPhone(phone).orElseThrow(() -> new RuntimeException("User not found")); }

    private CircleResponse mapToCircleResponse(Circle circle) {
        List<CircleMember> active = circleMemberRepository.findByCircleAndStatus(circle, CircleMember.MemberStatus.ACTIVE);
        List<CircleMemberResponse> members = active.stream().map(m -> CircleMemberResponse.builder()
                .userId(m.getUser().getId()).firstName(m.getUser().getFirstName()).lastName(m.getUser().getLastName())
                .phone(m.getUser().getPhone()).status(m.getStatus().name()).memberRole(m.getMemberRole().name())
                .circleTrustScore(m.getCircleTrustScore()).loansGivenInCircle(m.getLoansGivenInCircle())
                .loansReceivedInCircle(m.getLoansReceivedInCircle()).loansRepaidInCircle(m.getLoansRepaidInCircle())
                .defaultsInCircle(m.getDefaultsInCircle()).build()).collect(Collectors.toList());
        return CircleResponse.builder().id(circle.getId()).name(circle.getName()).description(circle.getDescription())
                .creatorName(circle.getCreator().getFirstName() + " " + circle.getCreator().getLastName())
                .creatorId(circle.getCreator().getId()).maxLoanAmount(circle.getMaxLoanAmount())
                .groupFundingThreshold(circle.getGroupFundingThreshold()).minTrustScore(circle.getMinTrustScore())
                .requireApprovalToJoin(circle.getRequireApprovalToJoin()).memberCount(active.size())
                .members(members).createdAt(circle.getCreatedAt()).build();
    }
}
