package com.smashflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smashflow.dto.SepayWebhookPayload;
import com.smashflow.dto.SepayWebhookResponse;
import com.smashflow.model.*;
import com.smashflow.repository.SepayWebhookEventRepository;
import com.smashflow.repository.SessionParticipantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
@RequiredArgsConstructor
public class SepayWebhookService {

    private final SepayWebhookEventRepository eventRepository;
    private final SessionParticipantRepository participantRepository;
    private final TelegramNotificationService telegramService;
    private final ObjectMapper objectMapper;

    @Value("${sepay.api-key:${SEPAY_API_KEY:}}")
    private String apiKey;

    @Value("${sepay.webhook-secret:${WEBHOOK_BANK_SECRET:}}")
    private String webhookSecret;

    @Value("${sepay.ip-check:${SEPAY_WEBHOOK_IP_CHECK:false}}")
    private boolean ipCheckEnabled;

    @Value("${sepay.base-url:${SEPAY_BASE_URL:https://my.sepay.vn}}")
    private String sepayBaseUrl;

    // Danh sách IP allowlist của SePay theo tài liệu chính thức
    private static final List<String> SEPAY_IPS = Arrays.asList(
            "103.179.189.100",
            "103.179.189.101",
            "103.179.189.102",
            "127.0.0.1",
            "0:0:0:0:0:0:0:1"
    );

    // Regex bắt mã giao dịch
    // Cọc: "COC SF123", "COCSF123", "COC-SF123", "SF123 COC"
    private static final Pattern DEPOSIT_PATTERN = Pattern.compile("(?i)(?:COC\\s*SF|SF\\s*COC|COC)\\s*-?\\s*(\\d+)");
    // Thanh toán tiền sân: "SF123", "SF 123", "SF-123", hỗ trợ cả "DV123"
    private static final Pattern PAYMENT_PATTERN = Pattern.compile("(?i)(?:SF|DV|CR)\\s*-?\\s*(\\d+)");

    /**
     * Xác thực Header Authorization theo chuẩn SePay:
     * - "Authorization: Apikey <KEY>"
     * - "Authorization: Bearer <SECRET>"
     */
    public void validateAuthorization(String authHeader) {
        String configuredSecret = (webhookSecret != null && !webhookSecret.isBlank()) ? webhookSecret.trim() : null;
        String configuredApiKey = (apiKey != null && !apiKey.isBlank() && !apiKey.equals("your_sepay_api_key")) ? apiKey.trim() : null;

        if (configuredSecret == null && configuredApiKey == null) {
            log.warn("SePay Webhook: Chưa cấu hình SEPAY_API_KEY hoặc WEBHOOK_BANK_SECRET");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Chưa cấu hình SEPAY_API_KEY và WEBHOOK_BANK_SECRET trên hệ thống");
        }

        if (authHeader == null || authHeader.isBlank()) {
            log.warn("SePay Webhook: Thiếu Authorization header");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Thiếu header Authorization");
        }

        String token = authHeader.trim();
        if (token.regionMatches(true, 0, "Apikey ", 0, 7)) {
            token = token.substring(7).trim();
        } else if (token.regionMatches(true, 0, "Bearer ", 0, 7)) {
            token = token.substring(7).trim();
        }

        boolean matchesSecret = configuredSecret != null && configuredSecret.equals(token);
        boolean matchesApiKey = configuredApiKey != null && configuredApiKey.equals(token);

        if (!matchesSecret && !matchesApiKey) {
            log.warn("SePay Webhook: Authorization token không hợp lệ");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authorization không hợp lệ");
        }
    }

    /**
     * Kiểm tra IP cho phép nếu bật cờ IP check
     */
    public void validateIpAddress(String remoteIp) {
        if (!ipCheckEnabled) {
            return;
        }
        if (remoteIp == null || !SEPAY_IPS.contains(remoteIp.trim())) {
            log.warn("SePay Webhook: IP {} không nằm trong danh sách allowlist SePay", remoteIp);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "IP không được cấp quyền truy cập webhook");
        }
    }

    /**
     * Xử lý webhook payload (overload cho đơn giản hóa khi không truyền raw JSON)
     */
    @Transactional
    public SepayWebhookResponse processWebhook(SepayWebhookPayload payload) {
        return processWebhook(payload, null);
    }

    /**
     * Xử lý webhook payload từ SePay gửi tới
     */
    @Transactional
    public SepayWebhookResponse processWebhook(SepayWebhookPayload payload, String rawPayload) {
        if (payload == null) {
            return new SepayWebhookResponse(false, "Payload is null");
        }

        Long transId = payload.getId();

        // 1. Chống ghi trùng (Idempotency) nếu có ID giao dịch
        if (transId != null && eventRepository.existsBySepayTransactionId(transId)) {
            log.info("SePay Webhook: Giao dịch #{} đã được ghi nhận trước đó, bỏ qua để chống trùng lặp", transId);
            return SepayWebhookResponse.builder()
                    .success(true)
                    .matched(true)
                    .message("Giao dịch đã được xử lý trước đó (Idempotency)")
                    .build();
        }

        // Tạo bản ghi log sự kiện
        SepayWebhookEvent event = SepayWebhookEvent.builder()
                .sepayTransactionId(transId)
                .gateway(payload.getGateway())
                .transactionDate(payload.getTransactionDate())
                .accountNumber(maskAccountNumber(payload.getAccountNumber()))
                .subAccount(payload.getSubAccount())
                .code(payload.getCode())
                .content(payload.getContent())
                .transferType(payload.getTransferType())
                .transferAmount(payload.getTransferAmount())
                .accumulated(payload.getAccumulated())
                .referenceCode(payload.getReferenceCode())
                .description(payload.getDescription())
                .rawPayload(rawPayload)
                .matched(false)
                .matchedType("NONE")
                .build();

        // 2. Kiểm tra loại giao dịch: chỉ nhận tiền vào (transferType: "in" hoặc để trống)
        if (payload.getTransferType() != null && "out".equalsIgnoreCase(payload.getTransferType().trim())) {
            event.setErrorMessage("Bỏ qua giao dịch chuyển tiền ra (transferType = out)");
            eventRepository.save(event);
            return SepayWebhookResponse.builder()
                    .success(true)
                    .matched(false)
                    .message("Ignored outgoing or non-incoming transfer")
                    .build();
        }

        BigDecimal transferAmount = payload.getTransferAmount() != null ? payload.getTransferAmount() : BigDecimal.ZERO;
        if (transferAmount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Invalid transfer amount: {}", transferAmount);
            event.setErrorMessage("Số tiền không hợp lệ: " + transferAmount);
            eventRepository.save(event);
            return SepayWebhookResponse.builder()
                    .success(false)
                    .matched(false)
                    .message("Invalid transfer amount")
                    .build();
        }

        // 3. Khớp nội dung để tìm Participant ID & loại thanh toán (Cọc vs Tiền sân)
        String combinedText = String.format("%s %s %s",
                payload.getContent() != null ? payload.getContent() : "",
                payload.getCode() != null ? payload.getCode() : "",
                payload.getDescription() != null ? payload.getDescription() : "").trim();

        ParsedPaymentInfo match = parsePaymentInfo(combinedText);

        if (match == null || match.participantId == null) {
            event.setErrorMessage("Nội dung không chứa mã nhận diện SF<id> hợp lệ: " + combinedText);
            eventRepository.save(event);
            return SepayWebhookResponse.builder()
                    .success(true)
                    .matched(false)
                    .message("No matching payment code in transaction content")
                    .build();
        }

        Long participantId = match.participantId;
        boolean isDeposit = match.isDeposit;
        event.setMatchedParticipantId(participantId);
        event.setMatchedType(isDeposit ? "DEPOSIT" : "FINAL_PAYMENT");

        // 4. Tra cứu SessionParticipant trong CSDL có khóa dòng ghi
        var optParticipant = participantRepository.findByIdForUpdate(participantId);
        if (optParticipant.isEmpty()) {
            event.setErrorMessage("Không tìm thấy người tham gia với ID: " + participantId);
            eventRepository.save(event);
            return SepayWebhookResponse.builder()
                    .success(true)
                    .matched(false)
                    .participantId(participantId)
                    .message("Participant not found: " + participantId)
                    .build();
        }

        SessionParticipant participant = optParticipant.get();

        // 5. Kiểm tra ca đánh có bị hủy hay không
        if (participant.getSession() != null && participant.getSession().getStatus() == SessionStatus.CANCELLED) {
            log.warn("Deposit/Payment webhook: session id={} is cancelled", participant.getSession().getId());
            event.setErrorMessage("Ca đánh đã bị hủy");
            eventRepository.save(event);
            telegramService.sendNotification(String.format(
                    "⚠️ <b>[SePay Webhook] Nhận %s ca đã hủy!</b>\nCa: %s\nKhách: %s (%s)\nSố tiền: %s VNĐ",
                    isDeposit ? "tiền cọc" : "thanh toán",
                    participant.getSession().getTitle(),
                    participantName(participant),
                    participantPhone(participant),
                    transferAmount.toPlainString()
            ));
            return SepayWebhookResponse.builder()
                    .success(true)
                    .matched(false)
                    .participantId(participantId)
                    .message("Session is cancelled")
                    .build();
        }

        if (isDeposit) {
            // Xử lý cọc giữ chỗ
            if (participant.getDepositStatus() == DepositStatus.PAID) {
                event.setMatched(true);
                eventRepository.save(event);
                return SepayWebhookResponse.builder()
                        .success(true)
                        .matched(true)
                        .participantId(participantId)
                        .paymentType("DEPOSIT")
                        .message("Deposit already confirmed")
                        .build();
            }

            BigDecimal requiredDeposit = participant.getDepositAmount() != null
                    ? participant.getDepositAmount()
                    : (participant.getSession() != null ? participant.getSession().getDepositAmount() : BigDecimal.ZERO);

            if (requiredDeposit != null && transferAmount.compareTo(requiredDeposit) < 0) {
                log.warn("Deposit underpaid for participant id={}: expected={}, actual={}", participantId, requiredDeposit, transferAmount);
                event.setErrorMessage(String.format("Số tiền chuyển (%s) nhỏ hơn tiền cọc yêu cầu (%s)", transferAmount, requiredDeposit));
                eventRepository.save(event);
                telegramService.sendNotification(String.format(
                        "⚠️ <b>[SePay CẢNH BÁO THIẾU TIỀN CỌC]</b>\n\n" +
                        "👤 <b>Khách hàng:</b> %s (%s)\n" +
                        "🏸 <b>Ca đánh:</b> %s\n" +
                        "💵 <b>Yêu cầu cọc:</b> %s VNĐ\n" +
                        "⚠️ <b>Thực nhận:</b> %s VNĐ\n" +
                        "📝 <b>Nội dung CK:</b> %s\n" +
                        "<i>Vui lòng liên hệ khách để bổ sung hoặc duyệt thủ công!</i>",
                        participantName(participant),
                        participantPhone(participant),
                        participant.getSession() != null ? participant.getSession().getTitle() : "N/A",
                        requiredDeposit.toPlainString(),
                        transferAmount.toPlainString(),
                        payload.getContent()
                ));
                return SepayWebhookResponse.builder()
                        .success(false)
                        .matched(false)
                        .participantId(participantId)
                        .paymentType("DEPOSIT")
                        .message("Transfer amount is less than required deposit")
                        .build();
            }

            // Đủ cọc -> Cập nhật trạng thái
            participant.setDepositStatus(DepositStatus.PAID);
            participant.setPaymentMethod(PaymentMethod.VIETQR);
            participantRepository.save(participant);

            event.setMatched(true);
            eventRepository.save(event);

            // Bắn Telegram thông báo tức thời
            telegramService.sendNotification(String.format(
                    "⚡ <b>[SmashFlow - SePay TỰ ĐỘNG DUYỆT CỌC]</b>\n\n" +
                    "👤 <b>Khách hàng:</b> %s (%s)\n" +
                    "💵 <b>Số tiền cọc:</b> %s VNĐ\n" +
                    "🏸 <b>Ca đánh:</b> %s\n" +
                    "🏦 <b>Ngân hàng:</b> %s (Ref: %s)\n" +
                    "✅ <b>Trạng thái:</b> Tự động duyệt thành công qua SePay! Đã nhận cọc VietQR",
                    participantName(participant),
                    participantPhone(participant),
                    transferAmount.toPlainString(),
                    participant.getSession() != null ? participant.getSession().getTitle() : "N/A",
                    payload.getGateway() != null ? payload.getGateway() : "N/A",
                    payload.getReferenceCode() != null ? payload.getReferenceCode() : String.valueOf(transId)
            ));

            return SepayWebhookResponse.builder()
                    .success(true)
                    .matched(true)
                    .participantId(participantId)
                    .paymentType("DEPOSIT")
                    .message("Deposit confirmed successfully")
                    .build();

        } else {
            // Xử lý thanh toán tiền sân cuối buổi
            if (participant.getPaymentStatus() == PaymentStatus.PAID) {
                event.setMatched(true);
                eventRepository.save(event);
                return SepayWebhookResponse.builder()
                        .success(true)
                        .matched(true)
                        .participantId(participantId)
                        .paymentType("FINAL_PAYMENT")
                        .message("Payment already settled")
                        .build();
            }

            BigDecimal remaining = participant.getRemainingPaymentAmount();
            if (remaining != null && transferAmount.compareTo(remaining) < 0) {
                log.warn("Final payment underpaid for participant id={}: expected={}, actual={}", participantId, remaining, transferAmount);
                event.setErrorMessage(String.format("Số tiền chuyển (%s) nhỏ hơn tiền sân cần thanh toán (%s)", transferAmount, remaining));
                eventRepository.save(event);
                telegramService.sendNotification(String.format(
                        "⚠️ <b>[SePay CẢNH BÁO THIẾU TIỀN SÂN]</b>\n\n" +
                        "👤 <b>Người chơi:</b> %s (%s)\n" +
                        "🏸 <b>Ca đánh:</b> %s\n" +
                        "💵 <b>Cần thu:</b> %s VNĐ\n" +
                        "⚠️ <b>Thực nhận:</b> %s VNĐ\n" +
                        "📝 <b>Nội dung CK:</b> %s\n" +
                        "<i>Vui lòng kiểm tra lại trước khi xác nhận hoàn tất!</i>",
                        participantName(participant),
                        participantPhone(participant),
                        participant.getSession() != null ? participant.getSession().getTitle() : "N/A",
                        remaining.toPlainString(),
                        transferAmount.toPlainString(),
                        payload.getContent()
                ));
                return SepayWebhookResponse.builder()
                        .success(false)
                        .matched(false)
                        .participantId(participantId)
                        .paymentType("FINAL_PAYMENT")
                        .message("Transfer amount is less than remaining bill")
                        .build();
            }

            // Đủ tiền -> Đánh dấu đã thanh toán
            participant.setPaymentStatus(PaymentStatus.PAID);
            participant.setPaymentMethod(PaymentMethod.VIETQR);
            participant.setPaidAt(LocalDateTime.now());
            participant.setPaidBy(null);
            participantRepository.save(participant);

            event.setMatched(true);
            eventRepository.save(event);

            // Bắn Telegram thông báo tức thời
            telegramService.sendNotification(String.format(
                    "🎉 <b>[SmashFlow - SePay TỰ ĐỘNG THU TIỀN SÂN]</b>\n\n" +
                    "👤 <b>Người chơi:</b> %s (%s)\n" +
                    "💵 <b>Số tiền thu:</b> %s VNĐ\n" +
                    "💳 <b>Phương thức:</b> VietQR (SePay Auto) - Đã nhận thanh toán tiền sân VietQR\n" +
                    "🏸 <b>Ca đánh:</b> %s\n" +
                    "🏦 <b>Ngân hàng:</b> %s (Ref: %s)",
                    participantName(participant),
                    participantPhone(participant),
                    transferAmount.toPlainString(),
                    participant.getSession() != null ? participant.getSession().getTitle() : "N/A",
                    payload.getGateway() != null ? payload.getGateway() : "N/A",
                    payload.getReferenceCode() != null ? payload.getReferenceCode() : String.valueOf(transId)
            ));

            return SepayWebhookResponse.builder()
                    .success(true)
                    .matched(true)
                    .participantId(participantId)
                    .paymentType("FINAL_PAYMENT")
                    .message("Payment settled successfully")
                    .build();
        }
    }

    /**
     * Đối soát thủ công qua SePay API: quét danh sách giao dịch từ SePay (GET /userapi/transactions/list)
     * để tự động duyệt nếu webhook bị trễ / rớt mạng.
     */
    @Transactional
    public SepayWebhookResponse reconcileParticipantWithSepay(Long participantId) {
        if (apiKey == null || apiKey.isBlank() || apiKey.equals("your_sepay_api_key")) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Chưa cấu hình SEPAY_API_KEY để gọi API đối soát SePay");
        }

        var optParticipant = participantRepository.findById(participantId);
        if (optParticipant.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người tham gia ID " + participantId);
        }

        try {
            HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
            String url = String.format("%s/userapi/transactions/list?limit=20", sepayBaseUrl);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", "Bearer " + apiKey.trim())
                    .header("Content-Type", "application/json")
                    .GET()
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("SePay reconciliation API trả mã lỗi: {}", response.statusCode());
                return SepayWebhookResponse.builder()
                        .success(false)
                        .matched(false)
                        .message("Không thể kết nối API SePay, HTTP status: " + response.statusCode())
                        .build();
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode transactionsNode = root.path("transactions");

            if (!transactionsNode.isArray()) {
                return SepayWebhookResponse.builder()
                        .success(false)
                        .matched(false)
                        .message("Định dạng dữ liệu giao dịch từ SePay không đúng")
                        .build();
            }

            String targetCode = "SF" + participantId;

            for (JsonNode t : transactionsNode) {
                String content = t.path("transaction_content").asText("");
                BigDecimal amountIn = new BigDecimal(t.path("amount_in").asText("0"));

                if (amountIn.compareTo(BigDecimal.ZERO) > 0 && content.toUpperCase().contains(targetCode.toUpperCase())) {
                    SepayWebhookPayload payload = SepayWebhookPayload.builder()
                            .id(t.path("id").asLong())
                            .gateway(t.path("bank_brand_name").asText())
                            .transactionDate(t.path("transaction_date").asText())
                            .accountNumber(t.path("account_number").asText())
                            .content(content)
                            .transferType("in")
                            .transferAmount(amountIn)
                            .referenceCode(t.path("reference_number").asText())
                            .build();

                    return processWebhook(payload, t.toString());
                }
            }

            return SepayWebhookResponse.builder()
                    .success(true)
                    .matched(false)
                    .participantId(participantId)
                    .message("Không tìm thấy giao dịch nào khớp với mã " + targetCode + " trên SePay")
                    .build();

        } catch (Exception e) {
            log.error("Lỗi khi gọi SePay reconciliation API: {}", e.getMessage(), e);
            return SepayWebhookResponse.builder()
                    .success(false)
                    .matched(false)
                    .message("Lỗi kết nối đối soát SePay: " + e.getMessage())
                    .build();
        }
    }

    /**
     * Lấy 50 lịch sử webhook gần nhất cho Host kiểm tra
     */
    public List<SepayWebhookEvent> getRecentEvents() {
        return eventRepository.findTop50ByOrderByCreatedAtDesc();
    }

    /**
     * Bóc tách thông tin mã SF và loại thanh toán từ chuỗi nội dung chuyển khoản
     */
    private ParsedPaymentInfo parsePaymentInfo(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }

        // 1. Kiểm tra pattern cọc trước ("COC SF123", "COCSF123")
        Matcher depositMatcher = DEPOSIT_PATTERN.matcher(text);
        if (depositMatcher.find()) {
            try {
                Long id = Long.parseLong(depositMatcher.group(1));
                return new ParsedPaymentInfo(id, true);
            } catch (NumberFormatException ignored) {}
        }

        // 2. Kiểm tra pattern thanh toán tiền sân ("SF123", "DV123")
        Matcher paymentMatcher = PAYMENT_PATTERN.matcher(text);
        if (paymentMatcher.find()) {
            try {
                Long id = Long.parseLong(paymentMatcher.group(1));
                boolean hasCoc = text.toUpperCase().contains("COC");
                return new ParsedPaymentInfo(id, hasCoc);
            } catch (NumberFormatException ignored) {}
        }

        return null;
    }

    private String maskAccountNumber(String acc) {
        if (acc == null || acc.length() <= 4) return acc;
        return "***" + acc.substring(acc.length() - 4);
    }

    private static String participantName(SessionParticipant p) {
        if (p == null) return "Khách";
        if (Boolean.TRUE.equals(p.getIsGuest())) {
            return p.getGuestName() != null && !p.getGuestName().isBlank() ? p.getGuestName() : "Khách vãng lai";
        }
        return p.getUser() != null && p.getUser().getFullName() != null && !p.getUser().getFullName().isBlank()
                ? p.getUser().getFullName()
                : (p.getGuestName() != null && !p.getGuestName().isBlank() ? p.getGuestName() : "Khách");
    }

    private static String participantPhone(SessionParticipant p) {
        if (p == null) return "N/A";
        if (Boolean.TRUE.equals(p.getIsGuest())) {
            return p.getGuestPhone() != null && !p.getGuestPhone().isBlank() ? p.getGuestPhone() : "N/A";
        }
        return p.getUser() != null && p.getUser().getPhone() != null && !p.getUser().getPhone().isBlank()
                ? p.getUser().getPhone()
                : (p.getGuestPhone() != null && !p.getGuestPhone().isBlank() ? p.getGuestPhone() : "N/A");
    }

    private static class ParsedPaymentInfo {
        Long participantId;
        boolean isDeposit;

        ParsedPaymentInfo(Long participantId, boolean isDeposit) {
            this.participantId = participantId;
            this.isDeposit = isDeposit;
        }
    }
}
