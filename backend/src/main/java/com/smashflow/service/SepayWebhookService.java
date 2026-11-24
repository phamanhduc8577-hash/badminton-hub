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
     * Xử lý webhook payload từ SePay gửi tới
     */
    @Transactional
    public SepayWebhookResponse processWebhook(SepayWebhookPayload payload, String rawPayload) {
        if (payload == null || payload.getId() == null) {
            return SepayWebhookResponse.builder()
                    .success(false)
                    .matched(false)
                    .message("Payload rỗng hoặc thiếu transaction id")
                    .build();
        }

        Long transId = payload.getId();

        // 1. Chống ghi trùng (Idempotency)
        if (eventRepository.existsBySepayTransactionId(transId)) {
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
                    .message("Bỏ qua giao dịch tiền ra")
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
                    .message("Không tìm thấy mã thanh toán SF trong nội dung giao dịch")
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
                    .message("Không tìm thấy người tham gia ID " + participantId)
                    .build();
        }

        SessionParticipant participant = optParticipant.get();
        BigDecimal transferAmount = payload.getTransferAmount() != null ? payload.getTransferAmount() : BigDecimal.ZERO;
        String participantName = participant.getIsGuest()
                ? participant.getGuestName()
                : (participant.getUser() != null ? participant.getUser().getFullName() : "Thành viên");

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
                        .message("Tiền cọc của lượt này đã được thanh toán trước đó")
                        .build();
            }

            BigDecimal requiredDeposit = participant.getDepositAmount() != null ? participant.getDepositAmount() : BigDecimal.ZERO;
            if (transferAmount.compareTo(requiredDeposit) < 0) {
                event.setErrorMessage(String.format("Số tiền chuyển (%s) nhỏ hơn tiền cọc yêu cầu (%s)", transferAmount, requiredDeposit));
                eventRepository.save(event);
                return SepayWebhookResponse.builder()
                        .success(true)
                        .matched(false)
                        .participantId(participantId)
                        .paymentType("DEPOSIT")
                        .message("Số tiền chuyển không đủ tiền cọc")
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
                    "⚡ [SePay] Đã nhận cọc VietQR thành công!\n👤 Người nộp: %s\n💰 Số tiền: %,d đ\n🔖 Mã: SF%d\n📅 Giao dịch: #%d (%s)",
                    participantName, transferAmount.longValue(), participantId, transId, payload.getGateway()
            ));

            return SepayWebhookResponse.builder()
                    .success(true)
                    .matched(true)
                    .participantId(participantId)
                    .paymentType("DEPOSIT")
                    .message("Xác nhận tiền cọc thành công qua SePay")
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
                        .message("Tiền sân của lượt này đã được thanh toán trước đó")
                        .build();
            }

            BigDecimal remaining = participant.getRemainingPaymentAmount();
            if (transferAmount.compareTo(remaining) < 0) {
                event.setErrorMessage(String.format("Số tiền chuyển (%s) nhỏ hơn tiền sân cần thanh toán (%s)", transferAmount, remaining));
                eventRepository.save(event);
                return SepayWebhookResponse.builder()
                        .success(true)
                        .matched(false)
                        .participantId(participantId)
                        .paymentType("FINAL_PAYMENT")
                        .message("Số tiền chuyển không đủ tiền sân còn lại")
                        .build();
            }

            // Đủ tiền -> Đánh dấu đã thanh toán
            participant.setPaymentStatus(PaymentStatus.PAID);
            participant.setPaymentMethod(PaymentMethod.VIETQR);
            participant.setPaidAt(LocalDateTime.now());
            participantRepository.save(participant);

            event.setMatched(true);
            eventRepository.save(event);

            // Bắn Telegram thông báo tức thời
            telegramService.sendNotification(String.format(
                    "🎉 [SePay] Đã nhận thanh toán tiền sân VietQR!\n👤 Người nộp: %s\n💰 Số tiền: %,d đ\n🔖 Mã: SF%d\n📅 Giao dịch: #%d (%s)",
                    participantName, transferAmount.longValue(), participantId, transId, payload.getGateway()
            ));

            return SepayWebhookResponse.builder()
                    .success(true)
                    .matched(true)
                    .participantId(participantId)
                    .paymentType("FINAL_PAYMENT")
                    .message("Xác nhận thanh toán tiền sân thành công qua SePay")
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

    private static class ParsedPaymentInfo {
        Long participantId;
        boolean isDeposit;

        ParsedPaymentInfo(Long participantId, boolean isDeposit) {
            this.participantId = participantId;
            this.isDeposit = isDeposit;
        }
    }
}
