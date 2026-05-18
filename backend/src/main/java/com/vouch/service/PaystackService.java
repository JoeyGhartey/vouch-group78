package com.vouch.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vouch.dto.PaymentInitResponse;
import com.vouch.entity.*;
import com.vouch.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaystackService {

    @Value("${paystack.secret.key}")
    private String paystackSecretKey;

    private static final String PAYSTACK_BASE_URL = "https://api.paystack.co";
    private static final String INITIALIZE_URL = PAYSTACK_BASE_URL + "/transaction/initialize";
    private static final String VERIFY_URL = PAYSTACK_BASE_URL + "/transaction/verify/";
    private static final String CHARGE_URL = PAYSTACK_BASE_URL + "/charge";

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final LoanRepository loanRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final TrustScoreService trustScoreService;
    private final CircleMemberRepository circleMemberRepository;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Initialize a payment for loan disbursement.
     * The lender pays, money goes to the borrower.
     */
    @Transactional
    public PaymentInitResponse initializeLoanDisbursement(String phone, Long loanId) {
        User lender = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (loan.getLender() == null || !lender.getId().equals(loan.getLender().getId())) {
            throw new RuntimeException("Only the lender can disburse");
        }
        if (loan.getStatus() != Loan.LoanStatus.AGREEMENT_SIGNED) {
            throw new RuntimeException("Agreement must be signed before disbursement");
        }

        String reference = "VOUCH-DISB-" + UUID.randomUUID().toString().substring(0, 8);
        int amountInPesewas = (int) (loan.getAmount() * 100);

        // Initialize transaction on Paystack
        Map<String, Object> payload = new HashMap<>();
        payload.put("email", lender.getEmail() != null ? lender.getEmail() : lender.getPhone() + "@vouch.app");
        payload.put("amount", amountInPesewas);
        payload.put("currency", "GHS");
        payload.put("reference", reference);
        payload.put("callback_url", "http://localhost:8081/payment/callback");

        Map<String, String> metadata = new HashMap<>();
        metadata.put("type", "LOAN_DISBURSEMENT");
        metadata.put("loan_id", loanId.toString());
        metadata.put("lender_id", lender.getId().toString());
        metadata.put("borrower_id", loan.getBorrower().getId().toString());
        payload.put("metadata", metadata);

        // If using mobile money
        if (lender.getMomoProvider() != null) {
            Map<String, String> mobileMoney = new HashMap<>();
            mobileMoney.put("phone", lender.getMomoNumber() != null ? lender.getMomoNumber() : lender.getPhone());
            mobileMoney.put("provider", mapMomoProvider(lender.getMomoProvider()));
            payload.put("mobile_money", mobileMoney);
        }

        JsonNode response = callPaystack(INITIALIZE_URL, payload);

        String authUrl = response.has("authorization_url") ? response.get("authorization_url").asText() : null;
        String accessCode = response.has("access_code") ? response.get("access_code").asText() : null;
        String paystackRef = response.has("reference") ? response.get("reference").asText() : reference;

        // Save payment record
        PaymentTransaction transaction = PaymentTransaction.builder()
                .reference(reference)
                .paystackReference(paystackRef)
                .payer(lender)
                .receiver(loan.getBorrower())
                .amount(loan.getAmount())
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

    /**
     * Initialize a payment for loan repayment.
     * The borrower pays, money goes to the lender.
     */
    @Transactional
    public PaymentInitResponse initializeLoanRepayment(String phone, Long loanId, Double amount) {
        User borrower = getUserByPhone(phone);
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (!borrower.getId().equals(loan.getBorrower().getId())) {
            throw new RuntimeException("Only the borrower can repay");
        }
        if (loan.getStatus() != Loan.LoanStatus.ACTIVE &&
            loan.getStatus() != Loan.LoanStatus.DUE &&
            loan.getStatus() != Loan.LoanStatus.GRACE_PERIOD) {
            throw new RuntimeException("Loan is not in a repayable state");
        }

        double totalOwed = loan.getTotalRepaymentAmount() + loan.getOverdueInterestAccrued() - loan.getAmountRepaid();
        double repayAmount = amount != null ? amount : totalOwed;

        if (repayAmount <= 0) throw new RuntimeException("Amount must be positive");
        if (repayAmount > totalOwed) throw new RuntimeException("Amount exceeds total owed: GHS " + String.format("%.2f", totalOwed));

        String reference = "VOUCH-REPAY-" + UUID.randomUUID().toString().substring(0, 8);
        int amountInPesewas = (int) (repayAmount * 100);

        Map<String, Object> payload = new HashMap<>();
        payload.put("email", borrower.getEmail() != null ? borrower.getEmail() : borrower.getPhone() + "@vouch.app");
        payload.put("amount", amountInPesewas);
        payload.put("currency", "GHS");
        payload.put("reference", reference);
        payload.put("callback_url", "http://localhost:8081/payment/callback");

        Map<String, String> metadata = new HashMap<>();
        metadata.put("type", "LOAN_REPAYMENT");
        metadata.put("loan_id", loanId.toString());
        metadata.put("borrower_id", borrower.getId().toString());
        metadata.put("lender_id", loan.getLender().getId().toString());
        metadata.put("repay_amount", String.valueOf(repayAmount));
        payload.put("metadata", metadata);

        if (borrower.getMomoProvider() != null) {
            Map<String, String> mobileMoney = new HashMap<>();
            mobileMoney.put("phone", borrower.getMomoNumber() != null ? borrower.getMomoNumber() : borrower.getPhone());
            mobileMoney.put("provider", mapMomoProvider(borrower.getMomoProvider()));
            payload.put("mobile_money", mobileMoney);
        }

        JsonNode response = callPaystack(INITIALIZE_URL, payload);

        String authUrl = response.has("authorization_url") ? response.get("authorization_url").asText() : null;
        String accessCode = response.has("access_code") ? response.get("access_code").asText() : null;
        String paystackRef = response.has("reference") ? response.get("reference").asText() : reference;

        PaymentTransaction transaction = PaymentTransaction.builder()
                .reference(reference)
                .paystackReference(paystackRef)
                .payer(borrower)
                .receiver(loan.getLender())
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

    /**
     * Verify a transaction after payment is complete.
     * Called by the frontend after the user completes payment on Paystack.
     */
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

        // Verify with Paystack
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + paystackSecretKey);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    VERIFY_URL + reference, HttpMethod.GET, entity, String.class);

            JsonNode jsonResponse = objectMapper.readTree(response.getBody());
            boolean success = jsonResponse.get("status").asBoolean();

            if (success) {
                JsonNode data = jsonResponse.get("data");
                String paymentStatus = data.get("status").asText();

                if ("success".equals(paymentStatus)) {
                    transaction.setStatus(PaymentTransaction.TransactionStatus.SUCCESS);
                    transaction.setGatewayResponse(data.has("gateway_response") ? data.get("gateway_response").asText() : "Success");
                    transaction.setPaymentChannel(data.has("channel") ? data.get("channel").asText() : "unknown");
                    transaction.setCompletedAt(java.time.LocalDateTime.now());
                    paymentTransactionRepository.save(transaction);

                    // Process the payment based on type
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
        } catch (Exception e) {
            log.error("Error verifying transaction: {}", e.getMessage());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "PENDING");
        result.put("message", "Could not verify payment. Please try again.");
        return result;
    }

    /**
     * Process a successful payment — update loan status, trust scores, etc.
     */
    private void processSuccessfulPayment(PaymentTransaction transaction) {
        if (transaction.getType() == PaymentTransaction.TransactionType.LOAN_DISBURSEMENT) {
            processLoanDisbursement(transaction);
        } else if (transaction.getType() == PaymentTransaction.TransactionType.LOAN_REPAYMENT) {
            processLoanRepayment(transaction);
        }
    }

    private void processLoanDisbursement(PaymentTransaction transaction) {
        Loan loan = loanRepository.findById(transaction.getLoanId())
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        loan.setStatus(Loan.LoanStatus.ACTIVE);
        loan.setDisbursedAt(java.time.LocalDateTime.now());

        if (loan.getDueDate() == null) {
            loan.setDueDate(java.time.LocalDateTime.now().plusMonths(loan.getRepaymentPeriodMonths()));
        }

        // Update stats
        User borrower = loan.getBorrower();
        borrower.setTotalLoansReceived(borrower.getTotalLoansReceived() + 1);
        userRepository.save(borrower);

        User lender = loan.getLender();
        lender.setTotalLoansGiven(lender.getTotalLoansGiven() + 1);
        userRepository.save(lender);

        // Update circle stats
        circleMemberRepository.findByCircleAndUser(loan.getCircle(), borrower).ifPresent(m -> {
            m.setLoansReceivedInCircle(m.getLoansReceivedInCircle() + 1);
            circleMemberRepository.save(m);
        });

        circleMemberRepository.findByCircleAndUser(loan.getCircle(), lender).ifPresent(m -> {
            m.setLoansGivenInCircle(m.getLoansGivenInCircle() + 1);
            circleMemberRepository.save(m);
        });

        loanRepository.save(loan);

        // Notify
        notificationService.send(borrower, "Loan Disbursed",
                "GHS " + loan.getAmount() + " has been sent to your account from " + lender.getFirstName(),
                Notification.NotificationType.LOAN_DISBURSED, loan.getId());
        notificationService.send(lender, "Loan Disbursed",
                "GHS " + loan.getAmount() + " has been sent to " + borrower.getFirstName(),
                Notification.NotificationType.LOAN_DISBURSED, loan.getId());

        log.info("Loan {} disbursed successfully via Paystack", loan.getId());
    }

    private void processLoanRepayment(PaymentTransaction transaction) {
        Loan loan = loanRepository.findById(transaction.getLoanId())
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        double repayAmount = transaction.getAmount();
        loan.setAmountRepaid(Math.round((loan.getAmountRepaid() + repayAmount) * 100.0) / 100.0);

        double totalOwed = loan.getTotalRepaymentAmount() + loan.getOverdueInterestAccrued();

        if (loan.getAmountRepaid() >= totalOwed) {
            loan.setStatus(Loan.LoanStatus.REPAID);
            loan.setCompletedAt(java.time.LocalDateTime.now());

            boolean onTime = loan.getGracePeriodStart() == null;
            trustScoreService.updateScoreOnRepayment(loan.getBorrower(), loan, onTime);

            User borrower = loan.getBorrower();
            borrower.setLoansRepaidOnTime(borrower.getLoansRepaidOnTime() + (onTime ? 1 : 0));
            userRepository.save(borrower);

            circleMemberRepository.findByCircleAndUser(loan.getCircle(), borrower).ifPresent(m -> {
                m.setLoansRepaidInCircle(m.getLoansRepaidInCircle() + 1);
                circleMemberRepository.save(m);
            });

            notificationService.send(loan.getLender(), "Loan Repaid",
                    loan.getBorrower().getFirstName() + " has fully repaid GHS " + loan.getAmount(),
                    Notification.NotificationType.LOAN_REPAID, loan.getId());
            notificationService.send(loan.getBorrower(), "Loan Repaid",
                    "You have fully repaid your loan of GHS " + loan.getAmount(),
                    Notification.NotificationType.LOAN_REPAID, loan.getId());
        } else {
            notificationService.send(loan.getLender(), "Partial Repayment",
                    loan.getBorrower().getFirstName() + " repaid GHS " + repayAmount + ". Remaining: GHS " + String.format("%.2f", totalOwed - loan.getAmountRepaid()),
                    Notification.NotificationType.LOAN_REPAID, loan.getId());
        }

        loanRepository.save(loan);
        log.info("Loan {} repayment of GHS {} processed via Paystack", loan.getId(), repayAmount);
    }

    /**
     * Webhook handler — Paystack calls this to notify us of payment status.
     */
    @Transactional
    public void handleWebhook(String payload) {
        try {
            JsonNode event = objectMapper.readTree(payload);
            String eventType = event.get("event").asText();

            if ("charge.success".equals(eventType)) {
                JsonNode data = event.get("data");
                String reference = data.get("reference").asText();

                PaymentTransaction transaction = paymentTransactionRepository.findByReference(reference).orElse(null);
                if (transaction != null && transaction.getStatus() != PaymentTransaction.TransactionStatus.SUCCESS) {
                    transaction.setStatus(PaymentTransaction.TransactionStatus.SUCCESS);
                    transaction.setGatewayResponse(data.has("gateway_response") ? data.get("gateway_response").asText() : "Success");
                    transaction.setPaymentChannel(data.has("channel") ? data.get("channel").asText() : "unknown");
                    transaction.setCompletedAt(java.time.LocalDateTime.now());
                    paymentTransactionRepository.save(transaction);

                    processSuccessfulPayment(transaction);
                }
            }

            log.info("Paystack webhook processed: {}", eventType);
        } catch (Exception e) {
            log.error("Error processing webhook: {}", e.getMessage());
        }
    }

    /**
     * Call Paystack API
     */
    private JsonNode callPaystack(String url, Map<String, Object> payload) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + paystackSecretKey);

        try {
            String jsonBody = objectMapper.writeValueAsString(payload);
            HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

            JsonNode jsonResponse = objectMapper.readTree(response.getBody());

            if (jsonResponse.get("status").asBoolean()) {
                return jsonResponse.get("data");
            } else {
                String message = jsonResponse.has("message") ? jsonResponse.get("message").asText() : "Paystack error";
                throw new RuntimeException("Paystack: " + message);
            }
        } catch (Exception e) {
            if (e instanceof RuntimeException) throw (RuntimeException) e;
            log.error("Paystack API call failed: {}", e.getMessage());
            throw new RuntimeException("Payment service unavailable. Please try again.");
        }
    }

    /**
     * Map MoMo provider names to Paystack codes
     */
    private String mapMomoProvider(String provider) {
        if (provider == null) return "mtn";
        switch (provider.toUpperCase()) {
            case "MTN": return "mtn";
            case "TELECEL": case "VODAFONE": return "vod";
            case "AIRTELTIGO": case "AIRTEL": case "TIGO": return "tgo";
            default: return "mtn";
        }
    }

    private User getUserByPhone(String phone) {
        return userRepository.findByPhone(phone).orElseThrow(() -> new RuntimeException("User not found"));
    }
}
