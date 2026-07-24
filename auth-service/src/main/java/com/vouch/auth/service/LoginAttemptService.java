package com.vouch.auth.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Tracks failed login attempts per IP address.
 * Blocks an IP after 10 failed attempts within a session.
 * This is a first line of defence against brute force attacks.
 */
@Service
@Slf4j
public class LoginAttemptService {

    private static final int MAX_ATTEMPTS = 10;
    private final ConcurrentHashMap<String, AtomicInteger> attemptsCache = new ConcurrentHashMap<>();

    public void loginSucceeded(String ipAddress) {
        attemptsCache.remove(ipAddress);
    }

    public void loginFailed(String ipAddress) {
        AtomicInteger attempts = attemptsCache.computeIfAbsent(ipAddress, k -> new AtomicInteger(0));
        int count = attempts.incrementAndGet();
        log.warn("Failed login attempt {} from IP: {}", count, ipAddress);
    }

    public boolean isBlocked(String ipAddress) {
        AtomicInteger attempts = attemptsCache.get(ipAddress);
        if (attempts == null) return false;
        boolean blocked = attempts.get() >= MAX_ATTEMPTS;
        if (blocked) {
            log.warn("IP {} is blocked due to too many failed login attempts", ipAddress);
        }
        return blocked;
    }

    public int getAttempts(String ipAddress) {
        AtomicInteger attempts = attemptsCache.get(ipAddress);
        return attempts == null ? 0 : attempts.get();
    }
}