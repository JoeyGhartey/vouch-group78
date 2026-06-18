package com.vouch.dispute.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class LoanServiceClient {

    private final RestTemplate restTemplate;

    @Value("${services.loan-service.url}")
    private String loanServiceUrl;

    @SuppressWarnings("unchecked")
    public Map<String, Object> getLoanDetails(Long loanId) {
        Map<String, Object> response = restTemplate.getForObject(
                loanServiceUrl + "/api/internal/loans/" + loanId, Map.class);
        if (response == null || !response.containsKey("id")) {
            throw new RuntimeException("Loan not found in loan-service");
        }
        return response;
    }

    @SuppressWarnings("unchecked")
    public void setLoanDisputed(Long loanId) {
        restTemplate.postForObject(
                loanServiceUrl + "/api/internal/loans/" + loanId + "/set-disputed",
                null, Map.class);
    }
}
