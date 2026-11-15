package com.smashflow.controller;

import com.smashflow.dto.SepayWebhookPayload;
import com.smashflow.dto.SepayWebhookResponse;
import com.smashflow.service.SepayWebhookService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SepayWebhookControllerTest {

    @Mock
    private SepayWebhookService sepayWebhookService;

    @InjectMocks
    private SepayWebhookController controller;

    private SepayWebhookPayload payload;

    @BeforeEach
    void setUp() {
        payload = SepayWebhookPayload.builder()
                .id(1L)
                .transferType("in")
                .transferAmount(new BigDecimal("50000"))
                .content("COC SF101")
                .build();
    }

    @Test
    @DisplayName("Khi không cấu hình API Key, webhook được xử lý bình thường")
    void handleWebhook_noApiKeyConfigured() {
        ReflectionTestUtils.setField(controller, "configuredApiKey", "");
        when(sepayWebhookService.processWebhook(any()))
                .thenReturn(new SepayWebhookResponse(true, "OK"));

        ResponseEntity<SepayWebhookResponse> response = controller.handleSepayWebhook(null, payload);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().isSuccess());
        verify(sepayWebhookService).processWebhook(payload);
    }

    @Test
    @DisplayName("API Key khớp với header 'Apikey <key>' -> 200 OK")
    void handleWebhook_withApiKey_validApikeyPrefix() {
        ReflectionTestUtils.setField(controller, "configuredApiKey", "secret123");
        when(sepayWebhookService.processWebhook(any()))
                .thenReturn(new SepayWebhookResponse(true, "OK"));

        ResponseEntity<SepayWebhookResponse> response = controller.handleSepayWebhook("Apikey secret123", payload);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().isSuccess());
    }

    @Test
    @DisplayName("API Key khớp với header 'Bearer <key>' -> 200 OK")
    void handleWebhook_withApiKey_validBearerPrefix() {
        ReflectionTestUtils.setField(controller, "configuredApiKey", "secret123");
        when(sepayWebhookService.processWebhook(any()))
                .thenReturn(new SepayWebhookResponse(true, "OK"));

        ResponseEntity<SepayWebhookResponse> response = controller.handleSepayWebhook("Bearer secret123", payload);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().isSuccess());
    }

    @Test
    @DisplayName("API Key sai -> 401 UNAUTHORIZED, không gọi service")
    void handleWebhook_withApiKey_invalidKey() {
        ReflectionTestUtils.setField(controller, "configuredApiKey", "secret123");

        ResponseEntity<SepayWebhookResponse> response = controller.handleSepayWebhook("Apikey wrong-key", payload);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertFalse(response.getBody().isSuccess());
        verify(sepayWebhookService, never()).processWebhook(any());
    }

    @Test
    @DisplayName("Thiếu header Authorization khi có cấu hình API Key -> 401 UNAUTHORIZED")
    void handleWebhook_withApiKey_missingHeader() {
        ReflectionTestUtils.setField(controller, "configuredApiKey", "secret123");

        ResponseEntity<SepayWebhookResponse> response = controller.handleSepayWebhook(null, payload);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertFalse(response.getBody().isSuccess());
        verify(sepayWebhookService, never()).processWebhook(any());
    }
}
