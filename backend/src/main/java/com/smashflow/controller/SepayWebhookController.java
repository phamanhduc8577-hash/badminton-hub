package com.smashflow.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smashflow.dto.SepayWebhookPayload;
import com.smashflow.dto.SepayWebhookResponse;
import com.smashflow.model.SepayWebhookEvent;
import com.smashflow.model.User;
import com.smashflow.service.SepayWebhookService;
import com.smashflow.service.VietQrService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Slf4j
public class SepayWebhookController {

    private final SepayWebhookService sepayWebhookService;
    private final VietQrService vietQrService;
    private final ObjectMapper objectMapper;

    @Value("${sepay.api-key:${SEPAY_API_KEY:}}")
    private String apiKey;

    /**
     * Endpoint chính và các alias nhận Webhook từ SePay khi có biến động số dư:
     * - POST /api/sepay/webhook (Đường dẫn chuẩn khuyến nghị)
     * - POST /api/webhook/sepay (Alias)
     * - POST /api/webhooks (Alias)
     * - POST /webhook/bank (Alias Seller API)
     * - POST /webhook/sepay (Alias)
     */
    @PostMapping({
            "/api/sepay/webhook",
            "/api/webhook/sepay",
            "/api/webhooks",
            "/api/webhooks/webhook",
            "/api/webhook",
            "/api/sepay",
            "/webhook/bank",
            "/webhook/sepay"
    })
    public ResponseEntity<SepayWebhookResponse> handleSepayWebhook(
            @RequestBody String rawPayload,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpServletRequest request
    ) {
        // 1. Xác thực bảo mật Authorization header (Apikey / Bearer secret)
        sepayWebhookService.validateAuthorization(authHeader);

        // 2. Kiểm tra IP allowlist nếu bật cấu hình
        if (request != null) {
            String remoteIp = extractClientIp(request);
            sepayWebhookService.validateIpAddress(remoteIp);
        }

        // 3. Parse JSON payload
        SepayWebhookPayload payload;
        try {
            payload = objectMapper.readValue(rawPayload, SepayWebhookPayload.class);
        } catch (Exception e) {
            log.error("Lỗi parse JSON webhook từ SePay: {}", e.getMessage());
            return ResponseEntity.badRequest().body(SepayWebhookResponse.builder()
                    .success(false)
                    .matched(false)
                    .message("Dữ liệu JSON không hợp lệ: " + e.getMessage())
                    .build());
        }

        // 4. Xử lý logic và phản hồi HTTP 200
        SepayWebhookResponse response = sepayWebhookService.processWebhook(payload, rawPayload);
        return ResponseEntity.ok(response);
    }

    /**
     * Nút "Kiểm tra thanh toán SePay" thủ công trên giao diện:
     * Quét giao dịch gần nhất từ API SePay đối soát nếu webhook bị chậm.
     */
    @PostMapping("/api/sepay/reconcile/{participantId}")
    public ResponseEntity<SepayWebhookResponse> reconcileParticipant(
            @PathVariable Long participantId,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Bạn cần đăng nhập để thực hiện thao tác này");
        }
        return ResponseEntity.ok(sepayWebhookService.reconcileParticipantWithSepay(participantId));
    }

    /**
     * CS & Giám sát Webhook: Xem lịch sử các lần nhận webhook (Chỉ dành cho Host)
     */
    @GetMapping("/api/sepay/events")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<List<SepayWebhookEvent>> getRecentWebhookEvents() {
        return ResponseEntity.ok(sepayWebhookService.getRecentEvents());
    }

    /**
     * Lấy cấu hình thanh toán ngân hàng & trạng thái Webhook
     */
    @GetMapping("/api/sepay/config")
    public ResponseEntity<Map<String, Object>> getPaymentConfig() {
        Map<String, Object> config = new HashMap<>();
        boolean isConfigured = apiKey != null && !apiKey.isBlank() && !apiKey.equals("your_sepay_api_key");
        config.put("webhookEnabled", isConfigured);

        Map<String, String> bankInfo = new HashMap<>();
        bankInfo.put("bankId", vietQrService.getBankId());
        bankInfo.put("accountNo", vietQrService.getAccountNo());
        bankInfo.put("accountName", vietQrService.getAccountName());
        config.put("bank", bankInfo);

        return ResponseEntity.ok(config);
    }

    private String extractClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }
}
