package com.vouch.payment.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PaymentInitResponse {
    private String authorizationUrl;
    private String accessCode;
    private String reference;
    private String message;
}
