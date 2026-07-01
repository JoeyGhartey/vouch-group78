package com.vouch.auth.service;

import com.vouch.auth.entity.User;
import com.vouch.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BadgeService {

    private final UserRepository userRepository;

    public static class Badge {
        public String id;
        public String name;
        public String description;
        public String icon;
        public boolean earned;

        public Badge(String id, String name, String description, String icon, boolean earned) {
            this.id = id;
            this.name = name;
            this.description = description;
            this.icon = icon;
            this.earned = earned;
        }
    }

    public List<Badge> getBadgesForUser(String phone) {
        User user = userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Badge> badges = new ArrayList<>();

        // 🚀 Rising Star — first loan repaid on time
        badges.add(new Badge(
            "rising_star",
            "Rising Star",
            "Repaid your first loan on time",
            "🚀",
            user.getLoansRepaidOnTime() >= 1
        ));

        // 🤝 Trusted Borrower — repaid 3+ loans on time
        badges.add(new Badge(
            "trusted_borrower",
            "Trusted Borrower",
            "Repaid 3 or more loans on time",
            "🤝",
            user.getLoansRepaidOnTime() >= 3
        ));

        // 💰 Reliable Lender — lent to 5+ people
        badges.add(new Badge(
            "reliable_lender",
            "Reliable Lender",
            "Lent money to 5 or more people",
            "💰",
            user.getTotalLoansGiven() >= 5
        ));

        // ⭐ Circle Champion — trust score above 75
        badges.add(new Badge(
            "circle_champion",
            "Circle Champion",
            "Achieved a trust score above 75",
            "⭐",
            user.getTrustScore() != null && user.getTrustScore() >= 75
        ));

        // 🏆 Elite Member — trust score above 90
        badges.add(new Badge(
            "elite_member",
            "Elite Member",
            "Achieved a trust score above 90",
            "🏆",
            user.getTrustScore() != null && user.getTrustScore() >= 90
        ));

        // 🌟 Zero Defaults — never defaulted on a loan
        badges.add(new Badge(
            "zero_defaults",
            "Clean Record",
            "Never defaulted on a loan",
            "🌟",
            user.getDefaults() == 0 && user.getTotalLoansReceived() > 0
        ));

        return badges;
    }
}