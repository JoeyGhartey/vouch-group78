package com.vouch.loan.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class AppConfig {

    // Downstream calls (auth-service, notification-service, expense-service) have no
    // bound without this — a slow/cold-starting service would otherwise hang the
    // calling thread indefinitely, which under concurrent load exhausts the whole
    // request thread pool and takes loan-service down with it.
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(5))
                .setReadTimeout(Duration.ofSeconds(15))
                .build();
    }
}
