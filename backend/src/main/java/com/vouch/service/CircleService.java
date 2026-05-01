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

    @Transactional
    public CircleResponse createCircle(String phone, CreateCircleRequest request) {
        User creator = getUserByPhone(phone);

        Circle circle = Circle.builder()
                .name(request.getName())
                .description(request.getDescription())
                .creator(creator)
                .maxLoanAmount(request.getMaxLoanAmount() != null ? request.getMaxLoanAmount() : 5000.0)
                .groupFundingThreshold(request.getGroupFundingThreshold() != null ? request.getGroupFundingThreshold() : 3000.0)
                .minTrustScore(request.getMinTrustScore() != null ? request.getMinTrustScore() : 0.0)
                .requireApprovalToJoin(request.getRequireApprovalToJoin() != null ? request.getRequireApprovalToJoin() : true)
                .build();

        circle = circleRepository.save(circle);

        CircleMember creatorMember = CircleMember.builder()
                .circle(circle)
                .user(creator)
                .status(CircleMember.MemberStatus.ACTIVE)
                .memberRole(CircleMember.MemberRole.CREATOR)
                .build();

        circleMemberRepository.save(creatorMember);

        return mapToCircleResponse(circle);
    }

    public List<CircleResponse> getMyCircles(String phone) {
        User user = getUserByPhone(phone);
        List<CircleMember> memberships = circleMemberRepository.findByUserAndStatus(user, CircleMember.MemberStatus.ACTIVE);

        return memberships.stream()
                .map(m -> mapToCircleResponse(m.getCircle()))
                .collect(Collectors.toList());
    }

    public CircleResponse getCircle(String phone, Long circleId) {
        User user = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));

        validateMembership(circle, user);
        return mapToCircleResponse(circle);
    }

    @Transactional
    public String inviteMember(String phone, Long circleId, String inviteePhone) {
        User inviter = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));

        validateMembership(circle, inviter);

        User invitee = userRepository.findByPhone(inviteePhone)
                .orElseThrow(() -> new RuntimeException("User not found with phone: " + inviteePhone));

        if (circleMemberRepository.existsByCircleAndUser(circle, invitee)) {
            throw new RuntimeException("User is already a member or has a pending invitation");
        }

        if (invitee.getTrustScore() < circle.getMinTrustScore()) {
            throw new RuntimeException("User's trust score is below the circle's minimum requirement");
        }

        CircleMember.MemberStatus status = circle.getRequireApprovalToJoin()
                ? CircleMember.MemberStatus.PENDING
                : CircleMember.MemberStatus.ACTIVE;

        CircleMember member = CircleMember.builder()
                .circle(circle)
                .user(invitee)
                .status(status)
                .memberRole(CircleMember.MemberRole.MEMBER)
                .build();

        circleMemberRepository.save(member);

        return status == CircleMember.MemberStatus.ACTIVE
                ? "Member added successfully"
                : "Invitation sent, pending approval";
    }

    @Transactional
    public String approveMember(String phone, Long circleId, Long memberId) {
        User approver = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));

        CircleMember approverMember = circleMemberRepository.findByCircleAndUser(circle, approver)
                .orElseThrow(() -> new RuntimeException("You are not a member of this circle"));

        if (approverMember.getMemberRole() != CircleMember.MemberRole.CREATOR &&
            approverMember.getMemberRole() != CircleMember.MemberRole.ADMIN) {
            throw new RuntimeException("Only circle creator or admin can approve members");
        }

        CircleMember pendingMember = circleMemberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        if (pendingMember.getStatus() != CircleMember.MemberStatus.PENDING) {
            throw new RuntimeException("Member is not pending approval");
        }

        pendingMember.setStatus(CircleMember.MemberStatus.ACTIVE);
        circleMemberRepository.save(pendingMember);

        return "Member approved successfully";
    }

    @Transactional
    public String removeMember(String phone, Long circleId, Long userId) {
        User remover = getUserByPhone(phone);
        Circle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new RuntimeException("Circle not found"));

        CircleMember removerMember = circleMemberRepository.findByCircleAndUser(circle, remover)
                .orElseThrow(() -> new RuntimeException("You are not a member of this circle"));

        if (removerMember.getMemberRole() != CircleMember.MemberRole.CREATOR) {
            throw new RuntimeException("Only circle creator can remove members");
        }

        User userToRemove = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        CircleMember memberToRemove = circleMemberRepository.findByCircleAndUser(circle, userToRemove)
                .orElseThrow(() -> new RuntimeException("User is not a member of this circle"));

        memberToRemove.setStatus(CircleMember.MemberStatus.REMOVED);
        circleMemberRepository.save(memberToRemove);

        return "Member removed successfully";
    }

    public void validateMembership(Circle circle, User user) {
        CircleMember member = circleMemberRepository.findByCircleAndUser(circle, user)
                .orElseThrow(() -> new RuntimeException("You are not a member of this circle"));

        if (member.getStatus() != CircleMember.MemberStatus.ACTIVE) {
            throw new RuntimeException("Your membership is not active in this circle");
        }
    }

    private User getUserByPhone(String phone) {
        return userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private CircleResponse mapToCircleResponse(Circle circle) {
        List<CircleMember> activeMembers = circleMemberRepository.findByCircleAndStatus(circle, CircleMember.MemberStatus.ACTIVE);

        List<CircleMemberResponse> memberResponses = activeMembers.stream()
                .map(m -> CircleMemberResponse.builder()
                        .userId(m.getUser().getId())
                        .firstName(m.getUser().getFirstName())
                        .lastName(m.getUser().getLastName())
                        .phone(m.getUser().getPhone())
                        .status(m.getStatus().name())
                        .memberRole(m.getMemberRole().name())
                        .circleTrustScore(m.getCircleTrustScore())
                        .loansGivenInCircle(m.getLoansGivenInCircle())
                        .loansReceivedInCircle(m.getLoansReceivedInCircle())
                        .loansRepaidInCircle(m.getLoansRepaidInCircle())
                        .defaultsInCircle(m.getDefaultsInCircle())
                        .build())
                .collect(Collectors.toList());

        return CircleResponse.builder()
                .id(circle.getId())
                .name(circle.getName())
                .description(circle.getDescription())
                .creatorName(circle.getCreator().getFirstName() + " " + circle.getCreator().getLastName())
                .creatorId(circle.getCreator().getId())
                .maxLoanAmount(circle.getMaxLoanAmount())
                .groupFundingThreshold(circle.getGroupFundingThreshold())
                .minTrustScore(circle.getMinTrustScore())
                .requireApprovalToJoin(circle.getRequireApprovalToJoin())
                .memberCount(activeMembers.size())
                .members(memberResponses)
                .createdAt(circle.getCreatedAt())
                .build();
    }
}
