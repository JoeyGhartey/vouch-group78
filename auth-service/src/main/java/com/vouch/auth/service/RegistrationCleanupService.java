package com.vouch.auth.service;

import com.vouch.auth.entity.PendingRegistration;
import com.vouch.auth.repository.PendingRegistrationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

// Deletes pending registrations nobody ever finished verifying. Without this,
// someone who starts signing up and abandons it (never enters the OTP, loses
// the email, whatever) would permanently occupy that phone number and email
// address, since initiateRegistration checks for uniqueness against both the
// real users table AND leaves the pending row sitting there indefinitely.
// Runs hourly; anything older than the abandon window gets removed.
@Service
@RequiredArgsConstructor
@Slf4j
public class RegistrationCleanupService {

    private static final int ABANDON_WINDOW_MINUTES = 45;

    private final PendingRegistrationRepository pendingRegistrationRepository;

    @Scheduled(fixedRate = 3600000) // every hour
    public void purgeAbandonedRegistrations() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(ABANDON_WINDOW_MINUTES);
        List<PendingRegistration> stale = pendingRegistrationRepository.findByCreatedAtBefore(cutoff);
        if (!stale.isEmpty()) {
            pendingRegistrationRepository.deleteAll(stale);
            log.info("Purged {} abandoned pending registration(s) older than {} minutes", stale.size(), ABANDON_WINDOW_MINUTES);
        }
    }
}
