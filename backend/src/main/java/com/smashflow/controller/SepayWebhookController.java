package com.smashflow.controller;

import com.smashflow.dto.SepayWebhookPayload;
import com.smashflow.dto.SepayWebhookResponse;
import com.smashflow.service.SepayWebhookService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/webhooks", "/api/webhook", "/api/sepay"})
@RequiredArgsConstructor
@Slf4j
public class SepayWebhookController {

    private final SepayWebhookService sepayWebhookService;

    @Value("${sepay.api-key:}")
    private String configuredApiKey;

    @PostMapping({"/sepay", "/sepay/webhook", "/webhook"})
    public ResponseEntity<SepayWebhookResponse> handleSepayWebhook(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody SepayWebhookPayload payload) {

        // Validate API Key if configured
        if (configuredApiKey != null && !configuredApiKey.isBlank()) {
            if (!isValidApiKey(authHeader, configuredApiKey.trim())) {
                log.warn("SePay webhook rejected: invalid or missing Authorization header");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new SepayWebhookResponse(false, "Unauthorized: Invalid API key"));
            }
        }

        SepayWebhookResponse response = sepayWebhookService.processWebhook(payload);
        return ResponseEntity.ok(response);
    }

    private boolean isValidApiKey(String authHeader, String expectedKey) {
        if (authHeader == null || authHeader.isBlank()) {
            return false;
        }
        String header = authHeader.trim();
        // Support "Apikey <key>", "Bearer <key>", or raw "<key>"
        if (header.regionMatches(true, 0, "Apikey ", 0, 7)) {
            header = header.substring(7).trim();
        } else if (header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            header = header.substring(7).trim();
        }
        return header.equals(expectedKey);
    }
}
