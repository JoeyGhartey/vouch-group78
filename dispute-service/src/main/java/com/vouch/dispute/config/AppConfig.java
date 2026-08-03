package com.vouch.dispute.config;

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

    // Downstream calls (auth-service, loan-service, notification-service --
    // including circle lookups routed through loan-service) have no bound
    // without this -- a slow/cold-starting service would otherwise hang the
    // calling thread indefinitely, which under concurrent load exhausts the
    // whole request thread pool and takes dispute-service down with it.
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
    // (auth-service, loan-service, notification-service) can verify the
    // caller is actually another Vouch service, not a stranger who found the
    // URL. dispute-service has no internal endpoints of its own to protect --
    // this interceptor only covers the outbound half of the pattern.
    private ClientHttpRequestInterceptor internalApiKeyInterceptor() {
        return (request, body, execution) -> {
            request.getHeaders().add("X-Internal-Key", internalApiKey);
            return execution.execute(request, body);
        };
    }
}
