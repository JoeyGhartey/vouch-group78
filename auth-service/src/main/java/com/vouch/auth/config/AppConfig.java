package com.vouch.auth.config;

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

    // Used to push the password-reset OTP directly to Expo's push API, send
    // email via Brevo, and (as of the account-deletion feature) call
    // loan-service/expense-service's internal endpoints — bounded timeouts
    // so a slow/unreachable endpoint can't hang a request.
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(5))
                .setReadTimeout(Duration.ofSeconds(10))
                .additionalInterceptors(internalApiKeyInterceptor())
                .build();
    }

    // Attaches the shared internal-service secret to every outbound call this
    // RestTemplate makes, so the receiving service's InternalApiKeyFilter can
    // verify the caller is actually another Vouch service. Harmless on the
    // Brevo/Expo calls made via this same bean -- those APIs just ignore an
    // extra header they don't recognize.
    private ClientHttpRequestInterceptor internalApiKeyInterceptor() {
        return (request, body, execution) -> {
            request.getHeaders().add("X-Internal-Key", internalApiKey);
            return execution.execute(request, body);
        };
    }
}
