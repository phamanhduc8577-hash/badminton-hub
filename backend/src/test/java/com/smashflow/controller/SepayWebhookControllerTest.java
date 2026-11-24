package com.smashflow.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smashflow.config.SecurityConfig;
import com.smashflow.dto.SepayWebhookResponse;
import com.smashflow.security.TokenAuthenticator;
import com.smashflow.service.SepayWebhookService;
import com.smashflow.service.VietQrService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = SepayWebhookController.class)
@Import(SecurityConfig.class)
class SepayWebhookControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TokenAuthenticator tokenAuthenticator;

    @MockitoBean
    private SepayWebhookService sepayWebhookService;

    @MockitoBean
    private VietQrService vietQrService;

    @Test
    @DisplayName("Webhook SePay: Không có Authorization header -> 401 Unauthorized")
    void testWebhookMissingAuthReturns401() throws Exception {
        doThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Thiếu header Authorization"))
                .when(sepayWebhookService).validateAuthorization(null);

        mockMvc.perform(post("/api/sepay/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":1234,\"transferAmount\":50000}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Webhook SePay: Có Authorization hợp lệ -> 200 OK")
    void testWebhookValidAuthReturns200() throws Exception {
        doNothing().when(sepayWebhookService).validateAuthorization(eq("Apikey test_key"));

        when(sepayWebhookService.processWebhook(any(), any()))
                .thenReturn(SepayWebhookResponse.builder()
                        .success(true)
                        .matched(true)
                        .participantId(101L)
                        .paymentType("FINAL_PAYMENT")
                        .message("Xác nhận thành công")
                        .build());

        mockMvc.perform(post("/api/sepay/webhook")
                        .header("Authorization", "Apikey test_key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":1234,\"content\":\"SF101\",\"transferAmount\":50000,\"transferType\":\"in\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.matched").value(true))
                .andExpect(jsonPath("$.participantId").value(101));
    }

    @Test
    @DisplayName("Webhook SePay Alias: POST /webhook/bank hoạt động bình thường")
    void testWebhookAliasBankReturns200() throws Exception {
        doNothing().when(sepayWebhookService).validateAuthorization(any());

        when(sepayWebhookService.processWebhook(any(), any()))
                .thenReturn(SepayWebhookResponse.builder()
                        .success(true)
                        .matched(true)
                        .message("Thành công")
                        .build());

        mockMvc.perform(post("/webhook/bank")
                        .header("Authorization", "Bearer test_secret")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":1235,\"content\":\"SF101\",\"transferAmount\":50000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("GET /api/sepay/config: Trả về thông tin ngân hàng công khai")
    void testGetSepayConfig() throws Exception {
        when(vietQrService.getBankId()).thenReturn("MB");
        when(vietQrService.getAccountNo()).thenReturn("0325872682");
        when(vietQrService.getAccountName()).thenReturn("PHAM ANH DUC");

        mockMvc.perform(get("/api/sepay/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bank.bankId").value("MB"))
                .andExpect(jsonPath("$.bank.accountNo").value("0325872682"))
                .andExpect(jsonPath("$.bank.accountName").value("PHAM ANH DUC"));
    }
}
