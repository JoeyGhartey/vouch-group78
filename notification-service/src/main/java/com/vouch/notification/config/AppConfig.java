package com.vouch.notification.config;

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

    // Downstream calls (auth-service, for push token lookups) have no bound
    // without this — a slow/cold-starting service would otherwise hang the
    // calling thread indefinitely, which under concurrent load exhausts the
    // whole request thread pool and takes notification-service down with it.
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(5))
                .setReadTimeout(Duration.ofSeconds(15))
                .additionalInterceptors(internalApiKeyInterceptor())
                .build();
    }

    // Attaches the shared internal-service secret to every outbound call this
    // RestTemplate makes, so InternalApiKeyFilter on the RECEIVING service can
    // verify the caller is actually another Vouch service, not a stranger who
    // found the URL. See that filter's comment for the full reasoning. This
    // header is harmless on the rare non-internal call made via this same
    // bean (e.g. Brevo/Expo in other services) -- those APIs just ignore an
    // extra header they don't recognize.
    private ClientHttpRequestInterceptor internalApiKeyInterceptor() {
        return (request, body, execution) -> {
            request.getHeaders().add("X-Internal-Key", internalApiKey);
            return execution.execute(request, body);
        };
    }
}
