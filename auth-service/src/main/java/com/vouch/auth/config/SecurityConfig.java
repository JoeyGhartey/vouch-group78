package com.vouch.auth.config;

// This class was superseded by com.vouch.auth.security.SecurityConfig, which
// now owns the security filter chain, CORS config, and password encoder bean
// for this service. Having both classes active at once caused duplicate Spring
// bean registration and a boot-time crash. This file is intentionally left
// annotation-free (no @Configuration) so it registers nothing with Spring.
// Delete this file the next time you touch auth-service.
