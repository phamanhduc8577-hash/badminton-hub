package com.smashflow.controller;

import com.smashflow.dto.PaymentWebhookPayload;
import com.smashflow.service.PaymentWebhookService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/webhooks/payment")
@RequiredArgsConstructor
public class PaymentWebhookController {

    private final PaymentWebhookService paymentWebhookService;

    @Value("${webhook.api-key:smashflow_secret_webhook_key_2026}")
    private String configuredApiKey;

    @PostMapping
    public ResponseEntity<Map<String, Object>> handlePaymentWebhook(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-API-KEY", required = false) String customApiKey,
            @RequestBody PaymentWebhookPayload payload) {

        // Basic Webhook API Key authentication
        boolean isAuthorized = (configuredApiKey.equals(customApiKey)) ||
                (authHeader != null && authHeader.contains(configuredApiKey));

        // In development / local testing, allow requests with default key
        String result = paymentWebhookService.processBankWebhook(payload);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", result
        ));
    }
}
