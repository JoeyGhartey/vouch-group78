package com.vouch.payment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vouch.payment.dto.PaymentInitResponse;
import com.vouch.payment.entity.PaymentTransaction;
import com.vouch.payment.repository.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaystackService {

    @Value("${paystack.secret.key}")
    private String paystackSecretKey;

    @Value("${paystack.callback.url}")
    private String paystackCallbackUrl;

    private static final String PAYSTACK_BASE_URL = "https://api.paystack.co";
    private static final String INITIALIZE_URL = PAYSTACK_BASE_URL + "/transaction/initialize";
    private static final String VERIFY_URL = PAYSTACK_BASE_URL + "/transaction/verify/";

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final AuthServiceClient authServiceClient;
    private final LoanServiceClient loanServiceClient;
    private final NotificationServiceClient notificationServiceClient;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public PaymentInitResponse initializeLoanDisbursement(String phone, Long loanId) {
        Long payerId = authServiceClient.getUserIdByPhone(phone);
        Map<String, Object> payerInfo = authServiceClient.getUserInfoByPhone(phone);
        Map<String, Object> loan = loanServiceClient.getLoanDetails(loanId);

        Long lenderId = loan.get("lenderId") != null ? ((Number) loan.get("lenderId")).longValue() : null;
        Long borrowerId = ((Number) loan.get("borrowerId")).longValue();
        String status = (String) loan.get("status");
        Double amount = ((Number) loan.get("amount")).doubleValue();

        if (lenderId == null || !payerId.equals(lenderId)) {
            throw new RuntimeException("Only the lender can disburse");
        }
        if (!"AGREEMENT_SIGNED".equals(status)) {
            throw new RuntimeException("Agreement must be signed before disbursement");
        }

        String reference = "VOUCH-DISB-" + UUID.randomUUID().toString().substring(0, 8);
        int amountInPesewas = (int) (amount * 100);

        Map<String, Object> payload = new HashMap<>();
        String email = payerInfo.get("email") != null ? (String) payerInfo.get("email") : payerInfo.get("phone") + "@vouch.app";
        payload.put("email", email);
        payload.put("amount", amountInPesewas);
        payload.put("currency", "GHS");
        payload.put("reference", reference);
        payload.put("callback_url", paystackCallbackUrl);
        Map<String, String> metadata = new HashMap<>();
        metadata.put("type", "LOAN_DISBURSEMENT");
        metadata.put("loan_id", loanId.toString());
        metadata.put("lender_id", lenderId.toString());
        metadata.put("borrower_id", borrowerId.toString());
        payload.put("metadata", metadata);

        if (payerInfo.get("momoProvider") != null) {
            Map<String, String> mobileMoney = new HashMap<>();
            mobileMoney.put("phone", payerInfo.get("momoNumber") != null ? (String) payerInfo.get("momoNumber") : (String) payerInfo.get("phone"));
            mobileMoney.put("provider", mapMomoProvider((String) payerInfo.get("momoProvider")));
            payload.put("mobile_money", mobileMoney);
        }

        JsonNode response = callPaystack(INITIALIZE_URL, payload);

        String authUrl = response.has("authorization_url") ? response.get("authorization_url").asText() : null;
        String accessCode = response.has("access_code") ? response.get("access_code").asText() : null;
        String paystackRef = response.has("reference") ? response.get("reference").asText() : reference;

        PaymentTransaction transaction = PaymentTransaction.builder()
                .reference(reference)
                .paystackReference(paystackRef)
                .payerId(lenderId)
                .receiverId(borrowerId)
                .amount(amount)
                .currency("GHS")
                .type(PaymentTransaction.TransactionType.LOAN_DISBURSEMENT)
                .loanId(loanId)
                .authorizationUrl(authUrl)
                .accessCode(accessCode)
                .build();

        paymentTransactionRepository.save(transaction);

        return PaymentInitResponse.builder()
                .authorizationUrl(authUrl)
                .accessCode(accessCode)
                .reference(reference)
                .message("Payment initialized. Complete payment to disburse the loan.")
                .build();
    }

    @Transactional
    public PaymentInitResponse initializeLoanRepayment(String phone, Long loanId, Double amount) {
        Long payerId = authServiceClient.getUserIdByPhone(phone);
        Map<String, Object> payerInfo = authServiceClient.getUserInfoByPhone(phone);
        Map<String, Object> loan = loanServiceClient.getLoanDetails(loanId);

        Long borrowerId = ((Number) loan.get("borrowerId")).longValue();
        Long lenderId = loan.get("lenderId") != null ? ((Number) loan.get("lenderId")).longValue() : null;
        String status = (String) loan.get("status");
        Double totalRepayment = ((Number) loan.get("totalRepaymentAmount")).doubleValue();
        Double amountRepaid = ((Number) loan.get("amountRepaid")).doubleValue();
        Double overdueInterest = ((Number) loan.get("overdueInterestAccrued")).doubleValue();

        if (!payerId.equals(borrowerId)) {
            throw new RuntimeException("Only the borrower can repay");
        }
        if (!"ACTIVE".equals(status) && !"DUE".equals(status) && !"GRACE_PERIOD".equals(status)) {
            throw new RuntimeException("Loan is not in a repayable state");
        }

        double totalOwed = totalRepayment + overdueInterest - amountRepaid;
        double repayAmount = amount != null ? amount : totalOwed;

        if (repayAmount <= 0) throw new RuntimeException("Amount must be positive");
        if (repayAmount > totalOwed) throw new RuntimeException("Amount exceeds total owed: GHS " + String.format("%.2f", totalOwed));

        String reference = "VOUCH-REPAY-" + UUID.randomUUID().toString().substring(0, 8);
        int amountInPesewas = (int) (repayAmount * 100);

        Map<String, Object> payload = new HashMap<>();
        String email = payerInfo.get("email") != null ? (String) payerInfo.get("email") : payerInfo.get("phone") + "@vouch.app";
        payload.put("email", email);
        payload.put("amount", amountInPesewas);
        payload.put("currency", "GHS");
        payload.put("reference", reference);
        payload.put("callback_url", paystackCallbackUrl);
        Map<String, String> metadata = new HashMap<>();
        metadata.put("type", "LOAN_REPAYMENT");
        metadata.put("loan_id", loanId.toString());
        metadata.put("borrower_id", borrowerId.toString());
        metadata.put("lender_id", lenderId != null ? lenderId.toString() : "");
        metadata.put("repay_amount", String.valueOf(repayAmount));
        payload.put("metadata", metadata);

        if (payerInfo.get("momoProvider") != null) {
            Map<String, String> mobileMoney = new HashMap<>();
            mobileMoney.put("phone", payerInfo.get("momoNumber") != null ? (String) payerInfo.get("momoNumber") : (String) payerInfo.get("phone"));
            mobileMoney.put("provider", mapMomoProvider((String) payerInfo.get("momoProvider")));
            payload.put("mobile_money", mobileMoney);
        }

        JsonNode response = callPaystack(INITIALIZE_URL, payload);

        String authUrl = response.has("authorization_url") ? response.get("authorization_url").asText() : null;
        String accessCode = response.has("access_code") ? response.get("access_code").asText() : null;
        String paystackRef = response.has("reference") ? response.get("reference").asText() : reference;

        PaymentTransaction transaction = PaymentTransaction.builder()
                .reference(reference)
                .paystackReference(paystackRef)
                .payerId(borrowerId)
                .receiverId(lenderId != null ? lenderId : 0L)
                .amount(repayAmount)
                .currency("GHS")
                .type(PaymentTransaction.TransactionType.LOAN_REPAYMENT)
                .loanId(loanId)
                .authorizationUrl(authUrl)
                .accessCode(accessCode)
                .build();

        paymentTransactionRepository.save(transaction);

        return PaymentInitResponse.builder()
                .authorizationUrl(authUrl)
                .accessCode(accessCode)
                .reference(reference)
                .message("Payment initialized. Complete payment to repay the loan.")
                .build();
    }

    @Transactional
    public Map<String, Object> verifyTransaction(String reference) {
        PaymentTransaction transaction = paymentTransactionRepository.findByReference(reference)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        if (transaction.getStatus() == PaymentTransaction.TransactionStatus.SUCCESS) {
            Map<String, Object> result = new HashMap<>();
            result.put("status", "SUCCESS");
            result.put("message", "Payment already verified");
            return result;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + paystackSecretKey);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        ResponseEntity<String> response;
        try {
            response = restTemplate.exchange(VERIFY_URL + reference, HttpMethod.GET, entity, String.class);
        } catch (HttpStatusCodeException e) {
            log.error("Paystack verify returned HTTP {} for reference {}: {}", e.getStatusCode(), reference, e.getResponseBodyAsString());
            return errorResult("Paystack rejected the verification request (HTTP " + e.getStatusCode().value() + "). Please try again or contact support.");
        } catch (ResourceAccessException e) {
            log.error("Paystack verify timed out or network unreachable for reference {}: {}", reference, e.getMessage());
            return errorResult("Could not reach Paystack to verify this payment. Please check your connection and try again.");
        }

        JsonNode jsonResponse;
        try {
            jsonResponse = objectMapper.readTree(response.getBody());
        } catch (Exception e) {
            log.error("Paystack verify returned unparseable response for reference {}: {}", reference, response.getBody());
            return errorResult("Paystack returned an invalid response. Please try again.");
        }

        if (jsonResponse == null || !jsonResponse.has("status")) {
            log.error("Paystack verify response missing 'status' field for reference {}: {}", reference, response.getBody());
            return errorResult("Paystack returned an unexpected response format.");
        }

        boolean success = jsonResponse.get("status").asBoolean();

        if (success) {
            JsonNode data = jsonResponse.get("data");
            if (data == null || !data.has("status")) {
                log.error("Paystack verify success response missing data.status for reference {}: {}", reference, response.getBody());
                return errorResult("Paystack returned an incomplete response.");
            }
            String paymentStatus = data.get("status").asText();

            if ("success".equals(paymentStatus)) {
                transaction.setStatus(PaymentTransaction.TransactionStatus.SUCCESS);
                transaction.setGatewayResponse(data.has("gateway_response") ? data.get("gateway_response").asText() : "Success");
                transaction.setPaymentChannel(data.has("channel") ? data.get("channel").asText() : "unknown");
                transaction.setCompletedAt(LocalDateTime.now());
                paymentTransactionRepository.save(transaction);

                processSuccessfulPayment(transaction);

                Map<String, Object> result = new HashMap<>();
                result.put("status", "SUCCESS");
                result.put("message", "Payment verified and processed successfully");
                result.put("amount", transaction.getAmount());
                result.put("reference", transaction.getReference());
                return result;
            } else {
                transaction.setStatus(PaymentTransaction.TransactionStatus.FAILED);
                transaction.setGatewayResponse(paymentStatus);
                paymentTransactionRepository.save(transaction);

                Map<String, Object> result = new HashMap<>();
                result.put("status", "FAILED");
                result.put("message", "Payment was not successful: " + paymentStatus);
                return result;
            }
        }

        String message = jsonResponse.has("message") ? jsonResponse.get("message").asText() : "Verification failed";
        Map<String, Object> result = new HashMap<>();
        result.put("status", "PENDING");
        result.put("message", "Could not verify payment yet: " + message);
        return result;
    }

    private Map<String, Object> errorResult(String message) {
        Map<String, Object> result = new HashMap<>();
        result.put("status", "ERROR");
        result.put("message", message);
        return result;
    }

    @Transactional
    public Map<String, Object> simulatePaymentSuccess(String reference) {
        PaymentTransaction transaction = paymentTransactionRepository.findByReference(reference)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        if (transaction.getStatus() == PaymentTransaction.TransactionStatus.SUCCESS) {
            return Map.of("status", "ALREADY_PROCESSED", "message", "Payment already processed");
        }

        transaction.setStatus(PaymentTransaction.TransactionStatus.SUCCESS);
        transaction.setGatewayResponse("Simulated Success");
        transaction.setPaymentChannel("test");
        transaction.setCompletedAt(LocalDateTime.now());
        paymentTransactionRepository.save(transaction);

        processSuccessfulPayment(transaction);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "Payment simulated and processed successfully");
        result.put("amount", transaction.getAmount());
        result.put("reference", transaction.getReference());
        result.put("type", transaction.getType().name());
        return result;
    }

    private void processSuccessfulPayment(PaymentTransaction transaction) {
        if (transaction.getType() == PaymentTransaction.TransactionType.LOAN_DISBURSEMENT) {
            processLoanDisbursement(transaction);
        } else if (transaction.getType() == PaymentTransaction.TransactionType.LOAN_REPAYMENT) {
            processLoanRepayment(transaction);
        }
    }

    private void processLoanDisbursement(PaymentTransaction transaction) {
        Map<String, Object> result = loanServiceClient.completeDisbursement(transaction.getLoanId());
        log.info("Loan {} disbursement completed via payment-service: {}", transaction.getLoanId(), result);

        String lenderName = authServiceClient.getUserFirstName(transaction.getPayerId());
        String borrowerName = authServiceClient.getUserFirstName(transaction.getReceiverId());

        notificationServiceClient.send(transaction.getReceiverId(), "Loan Disbursed",
                "GHS " + transaction.getAmount() + " has been sent to your account from " + lenderName,
                "LOAN_DISBURSED", transaction.getLoanId());
        notificationServiceClient.send(transaction.getPayerId(), "Loan Disbursed",
                "GHS " + transaction.getAmount() + " has been sent to " + borrowerName,
                "LOAN_DISBURSED", transaction.getLoanId());
    }

    private void processLoanRepayment(PaymentTransaction transaction) {
        Map<String, Object> result = loanServiceClient.completeRepayment(
                transaction.getLoanId(), transaction.getAmount());
        log.info("Loan {} repayment of GHS {} processed via payment-service: {}",
                transaction.getLoanId(), transaction.getAmount(), result);

        boolean fullyRepaid = Boolean.TRUE.equals(result.get("fullyRepaid"));
        String borrowerName = authServiceClient.getUserFirstName(transaction.getPayerId());

        if (fullyRepaid) {
            if (transaction.getReceiverId() != 0L) {
                notificationServiceClient.send(transaction.getReceiverId(), "Loan Repaid",
                        borrowerName + " has fully repaid GHS " + transaction.getAmount(),
                        "LOAN_REPAID", transaction.getLoanId());
            }
            notificationServiceClient.send(transaction.getPayerId(), "Loan Repaid",
                    "You have fully repaid your loan",
                    "LOAN_REPAID", transaction.getLoanId());
        } else {
            Double remaining = result.get("remaining") != null ? ((Number) result.get("remaining")).doubleValue() : 0.0;
            if (transaction.getReceiverId() != 0L) {
                notificationServiceClient.send(transaction.getReceiverId(), "Partial Repayment",
                        borrowerName + " repaid GHS " + transaction.getAmount() + ". Remaining: GHS " + String.format("%.2f", remaining),
                        "LOAN_REPAID", transaction.getLoanId());
            }
        }
    }

    @Transactional
    public void handleWebhook(String payload, String signature) {
        if (!isValidSignature(payload, signature)) {
            log.warn("Rejected Paystack webhook: missing or invalid signature");
            throw new RuntimeException("Invalid webhook signature");
        }

        JsonNode event;
        try {
            event = objectMapper.readTree(payload);
        } catch (Exception e) {
            log.error("Failed to parse Paystack webhook payload: {}", e.getMessage());
            throw new RuntimeException("Malformed webhook payload");
        }

        String eventType = event.has("event") ? event.get("event").asText() : null;

        if ("charge.success".equals(eventType)) {
            JsonNode data = event.get("data");
            String reference = data.get("reference").asText();

            PaymentTransaction transaction = paymentTransactionRepository.findByReference(reference).orElse(null);
            if (transaction != null && transaction.getStatus() != PaymentTransaction.TransactionStatus.SUCCESS) {
                transaction.setStatus(PaymentTransaction.TransactionStatus.SUCCESS);
                transaction.setGatewayResponse(data.has("gateway_response") ? data.get("gateway_response").asText() : "Success");
                transaction.setPaymentChannel(data.has("channel") ? data.get("channel").asText() : "unknown");
                transaction.setCompletedAt(LocalDateTime.now());
                paymentTransactionRepository.save(transaction);

                processSuccessfulPayment(transaction);
            }
        }

        log.info("Paystack webhook processed: {}", eventType);
    }

    private boolean isValidSignature(String payload, String signature) {
        if (signature == null || signature.isBlank()) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(paystackSecretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String computed = HexFormat.of().formatHex(hash);
            return computed.equalsIgnoreCase(signature);
        } catch (Exception e) {
            log.error("Failed to compute webhook signature: {}", e.getMessage());
            return false;
        }
    }

    private JsonNode callPaystack(String url, Map<String, Object> payload) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + paystackSecretKey);

        ResponseEntity<String> response;
        try {
            String jsonBody = objectMapper.writeValueAsString(payload);
            HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);
            response = restTemplate.postForEntity(url, entity, String.class);
        } catch (HttpStatusCodeException e) {
            log.error("Paystack returned HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Paystack rejected the request (HTTP " + e.getStatusCode().value() + "): " + extractPaystackMessage(e.getResponseBodyAsString()));
        } catch (ResourceAccessException e) {
            log.error("Paystack request timed out or network unreachable: {}", e.getMessage());
            throw new RuntimeException("Could not reach Paystack. Please check your connection and try again.");
        } catch (Exception e) {
            log.error("Unexpected error building Paystack request: {}", e.getMessage());
            throw new RuntimeException("Payment service unavailable. Please try again.");
        }

        JsonNode jsonResponse;
        try {
            jsonResponse = objectMapper.readTree(response.getBody());
        } catch (Exception e) {
            log.error("Paystack returned unparseable response: {}", response.getBody());
            throw new RuntimeException("Paystack returned an invalid response. Please try again.");
        }

        if (jsonResponse == null || !jsonResponse.has("status")) {
            log.error("Paystack response missing 'status' field: {}", response.getBody());
            throw new RuntimeException("Paystack returned an unexpected response format.");
        }

        if (jsonResponse.get("status").asBoolean()) {
            if (!jsonResponse.has("data")) {
                log.error("Paystack success response missing 'data' field: {}", response.getBody());
                throw new RuntimeException("Paystack returned an incomplete response.");
            }
            return jsonResponse.get("data");
        } else {
            String message = jsonResponse.has("message") ? jsonResponse.get("message").asText() : "Paystack error";
            throw new RuntimeException("Paystack: " + message);
        }
    }

    private String extractPaystackMessage(String body) {
        try {
            JsonNode node = objectMapper.readTree(body);
            if (node != null && node.has("message")) return node.get("message").asText();
        } catch (Exception ignored) {
            // fall through to default below
        }
        return "Unknown error";
    }

    private String mapMomoProvider(String provider) {
        if (provider == null) return "mtn";
        switch (provider.toUpperCase()) {
            case "MTN": return "mtn";
            case "TELECEL": case "VODAFONE": return "vod";
            case "AIRTELTIGO": case "AIRTEL": case "TIGO": return "tgo";
            default: return "mtn";
        }
    }
}
