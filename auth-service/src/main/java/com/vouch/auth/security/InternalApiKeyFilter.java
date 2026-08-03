package com.vouch.auth.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

// Internal-only endpoints (/api/internal/**) are marked permitAll() in
// SecurityConfig since they're called service-to-service, never with a
// user's JWT. Without this filter, that meant literally anyone with the URL
// could call them with no credential at all -- and that's not a hypothetical
// here, since every service's base URL and every internal endpoint's exact
// path are sitting in this repo's public GitHub history. This filter
// requires a shared secret header, set identically on every service via
// INTERNAL_API_KEY, on any request to an internal path -- every other path
// passes through untouched, still gated by the normal JWT filter as before.
@Component
public class InternalApiKeyFilter extends OncePerRequestFilter {

    private static final String INTERNAL_PATH_PREFIX = "/api/internal/";
    private static final String HEADER_NAME = "X-Internal-Key";

    @Value("${internal.api.key}")
    private String internalApiKey;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {
        if (!request.getRequestURI().startsWith(INTERNAL_PATH_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        String providedKey = request.getHeader(HEADER_NAME);
        if (providedKey == null || !providedKey.equals(internalApiKey)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Missing or invalid internal service credential\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
