package com.vouch.payment.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class AppConfig {

    @Value("${internal.api.key}")
    private String internalApiKey;

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(5))
                .setReadTimeout(Duration.ofSeconds(15))
                .additionalInterceptors(internalApiKeyInterceptor())
                .build();
    }

    // Attaches the shared internal-service secret to every outbound call this
    // RestTemplate makes, so InternalApiKeyFilter on the RECEIVING service
    // (loan-service, auth-service, notification-service) can verify the caller
    // is actually another Vouch service, not a stranger who found the URL.
    // This header is harmless on the Paystack API calls also made via this
    // same RestTemplate bean -- Paystack just ignores an extra header it
    // doesn't recognize.
    private ClientHttpRequestInterceptor internalApiKeyInterceptor() {
        return (request, body, execution) -> {
            request.getHeaders().add("X-Internal-Key", internalApiKey);
            return execution.execute(request, body);
        };
    }
}
