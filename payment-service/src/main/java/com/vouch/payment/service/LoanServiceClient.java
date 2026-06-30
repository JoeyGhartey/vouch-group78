package com.vouch.payment.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
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
    public Map<String, Object> completeDisbursement(Long loanId) {
        return restTemplate.postForObject(
                loanServiceUrl + "/api/internal/loans/" + loanId + "/disburse-complete",
                null, Map.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> completeRepayment(Long loanId, Double amount) {
        return restTemplate.postForObject(
                loanServiceUrl + "/api/internal/loans/" + loanId + "/repay-complete",
                Map.of("amount", amount), Map.class);
    }
}
