package com.smashflow.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
@Slf4j
public class TelegramNotificationService {

    @Value("${telegram.bot-token:8664493359:AAEIrvA-XuX3aoclYOOh5bAyvMdDOLDu7UE}")
    private String botToken;

    @Value("${telegram.chat-id:8723745423}")
    private String chatId;

    @Value("${telegram.enabled:true}")
    private boolean enabled;

    private final RestTemplate restTemplate;

    public TelegramNotificationService() {
        this.restTemplate = new RestTemplate();
        // Force UTF-8 StringHttpMessageConverter
        this.restTemplate.getMessageConverters().add(0, new org.springframework.http.converter.StringHttpMessageConverter(java.nio.charset.StandardCharsets.UTF_8));
    }

    /**
     * Send notification to Host's Telegram.
     */
    public void sendNotification(String message) {
        String token = (botToken != null && !botToken.isBlank()) ? botToken.trim() : "8664493359:AAEIrvA-XuX3aoclYOOh5bAyvMdDOLDu7UE";
        String cid = (chatId != null && !chatId.isBlank()) ? chatId.trim() : "8723745423";

        if (!enabled) {
            log.warn("Telegram notification skipped: disabled");
            return;
        }

        // Run in detached thread to avoid blocking HTTP response
        new Thread(() -> {
            try {
                String url = "https://api.telegram.org/bot" + token + "/sendMessage";

                org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
                headers.setContentType(new org.springframework.http.MediaType("application", "json", java.nio.charset.StandardCharsets.UTF_8));

                Map<String, Object> body = Map.of(
                        "chat_id", cid,
                        "text", message,
                        "parse_mode", "HTML"
                );

                String jsonBody = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(body);
                org.springframework.http.HttpEntity<String> request = new org.springframework.http.HttpEntity<>(jsonBody, headers);
                ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

                if (response.getStatusCode().is2xxSuccessful()) {
                    log.info("Telegram notification sent successfully to chat_id={}", cid);
                } else {
                    log.warn("Telegram notification failed with status: {}, body: {}", response.getStatusCode(), response.getBody());
                }
            } catch (Exception e) {
                log.error("Error sending Telegram notification: {}", e.getMessage(), e);
            }
        }).start();
    }

    /**
     * Template: New slot registration notice
     */
    public void notifyNewBooking(String sessionTitle, String timeRange, String playerName, String phone, String gender, String memberType, String feeNote) {
        String msg = String.format(
                "🏸 <b>[SmashFlow] CÓ KHÁCH MỚI ĐĂNG KÝ!</b>\n\n" +
                "👤 <b>Tay vợt:</b> %s (%s - %s)\n" +
                "🏷️ <b>Hạng:</b> %s\n" +
                "🏆 <b>Ca đánh:</b> %s\n" +
                "⏰ <b>Thời gian:</b> %s\n" +
                "💰 <b>Trạng thái:</b> %s\n\n" +
                "<i>📱 Vui lòng kiểm tra trên Host Dashboard khi cần chốt danh sách!</i>",
                escapeHtml(playerName),
                escapeHtml(phone),
                gender.equalsIgnoreCase("FEMALE") ? "Nữ" : "Nam",
                escapeHtml(memberType),
                escapeHtml(sessionTitle),
                escapeHtml(timeRange),
                escapeHtml(feeNote)
        );
        sendNotification(msg);
    }

    /**
     * Template: Auto or Manual Deposit Confirmation
     */
    public void notifyDepositReceived(String sessionTitle, String playerName, String phone, String amount) {
        String msg = String.format(
                "⚡ <b>[SmashFlow] ĐÃ NHẬN TIỀN CỌC!</b>\n\n" +
                "👤 <b>Khách hàng:</b> %s (%s)\n" +
                "💵 <b>Số tiền cọc:</b> %s VNĐ\n" +
                "🏸 <b>Ca đánh:</b> %s\n" +
                "✅ <b>Trạng thái:</b> Đã xác nhận cọc - Mở khóa Điểm danh GPS cho khách!",
                escapeHtml(playerName),
                escapeHtml(phone),
                escapeHtml(amount),
                escapeHtml(sessionTitle)
        );
        sendNotification(msg);
    }

    /**
     * Template: Full Payment Settled
     */
    public void notifyPaymentSettled(String sessionTitle, String playerName, String phone, String amount, String method) {
        String msg = String.format(
                "💰 <b>[SmashFlow] THANH TOÁN TIỀN SÂN THÀNH CÔNG!</b>\n\n" +
                "👤 <b>Người thanh toán:</b> %s (%s)\n" +
                "💵 <b>Số tiền thu:</b> %s VNĐ\n" +
                "💳 <b>Phương thức:</b> %s\n" +
                "🏸 <b>Ca đánh:</b> %s",
                escapeHtml(playerName),
                escapeHtml(phone),
                escapeHtml(amount),
                escapeHtml(method),
                escapeHtml(sessionTitle)
        );
        sendNotification(msg);
    }

    /**
     * Template: Slot cancellation / no-show notice
     */
    public void notifySlotCancelled(String sessionTitle, String playerName, String phone, boolean forfeitDeposit) {
        String msg = String.format(
                "⚠️ <b>[SmashFlow] HỦY ĐĂNG KÝ SLOT!</b>\n\n" +
                "👤 <b>Thành viên:</b> %s (%s)\n" +
                "🏸 <b>Ca đánh:</b> %s\n" +
                "📌 <b>Xử lý cọc:</b> %s\n" +
                "🔄 <i>Slot đã được giải phóng để người khác đăng ký.</i>",
                escapeHtml(playerName),
                escapeHtml(phone),
                escapeHtml(sessionTitle),
                forfeitDeposit ? "Giữ cọc vào doanh thu quỹ ca đánh (Bùng kèo)" : "Hoàn trả slot không thu cọc"
        );
        sendNotification(msg);
    }

    /**
     * Template: New User Registration & Pending Approval Notice
     */
    public void notifyNewUserRegistered(String fullName, String phone, String gender, String membershipType) {
        String typeLabel = "PENDING_FIXED".equalsIgnoreCase(membershipType)
                ? "⏳ Đăng ký Thành viên Cố định (Đang chờ Host duyệt)"
                : "🟡 Thành viên / Khách Vãng lai";

        String msg = String.format(
                "🎉 <b>[SmashFlow] CÓ THÀNH VIÊN MỚI TẠO TÀI KHOẢN!</b>\n\n" +
                "👤 <b>Họ tên:</b> %s\n" +
                "📞 <b>Số điện thoại:</b> <code>%s</code>\n" +
                "⚧ <b>Giới tính:</b> %s\n" +
                "🏷️ <b>Phân loại:</b> %s\n\n" +
                "%s",
                escapeHtml(fullName),
                escapeHtml(phone),
                gender != null && gender.equalsIgnoreCase("FEMALE") ? "Nữ (Trợ giá)" : "Nam",
                typeLabel,
                "PENDING_FIXED".equalsIgnoreCase(membershipType)
                        ? "👉 <i>Vui lòng vào mục Thành viên trên Web để phê duyệt cho thành viên này!</i>"
                        : "✅ <i>Tài khoản đã kích hoạt sẵn sàng tham gia ca đánh.</i>"
        );
        sendNotification(msg);
    }

    /**
     * Template: Password Reset Request Notice
     */
    public void notifyForgotPasswordRequest(String playerName, String phone, String defaultPassword) {
        String msg = String.format(
                "🔐 <b>[SmashFlow] YÊU CẦU ĐẶT LẠI MẬT KHẨU!</b>\n\n" +
                "👤 <b>Thành viên:</b> %s\n" +
                "📞 <b>Số điện thoại:</b> <code>%s</code>\n" +
                "🔑 <b>Mật khẩu tạm đã cấp:</b> <code>%s</code>\n\n" +
                "<i>💡 Host vui lòng thông báo mật khẩu này cho thành viên, hoặc thành viên đã có thể đăng nhập bằng mật khẩu tạm trên và đổi mật khẩu mới trong Hồ sơ!</i>",
                escapeHtml(playerName),
                escapeHtml(phone),
                escapeHtml(defaultPassword)
        );
        sendNotification(msg);
    }

    private String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }
}
