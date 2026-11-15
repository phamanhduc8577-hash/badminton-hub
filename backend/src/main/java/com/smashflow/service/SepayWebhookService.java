package com.smashflow.service;

import com.smashflow.dto.SepayWebhookPayload;
import com.smashflow.dto.SepayWebhookResponse;
import com.smashflow.model.DepositStatus;
import com.smashflow.model.PaymentMethod;
import com.smashflow.model.PaymentStatus;
import com.smashflow.model.SessionParticipant;
import com.smashflow.model.SessionStatus;
import com.smashflow.repository.SessionParticipantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
@RequiredArgsConstructor
public class SepayWebhookService {

    private final SessionParticipantRepository participantRepository;
    private final TelegramNotificationService telegramNotificationService;

    // Pattern for Deposit: matches "COC SF12", "COCSF12", "coc sf 12", etc.
    private static final Pattern DEPOSIT_PATTERN = Pattern.compile("(?i)COC\\s*SF\\s*(\\d+)");

    // Pattern for Final Bill: matches "SF12", "SF 12", "MBVCB.SF12", etc. (isolated from letters)
    private static final Pattern FINAL_PAYMENT_PATTERN = Pattern.compile("(?i)(?:^|[^a-zA-Z0-9])SF\\s*(\\d+)(?:$|[^a-zA-Z0-9])");

    @Transactional
    public SepayWebhookResponse processWebhook(SepayWebhookPayload payload) {
        if (payload == null) {
            return new SepayWebhookResponse(false, "Payload is null");
        }

        log.info("Processing SePay webhook: id={}, transferType={}, amount={}, content='{}'",
                payload.getId(), payload.getTransferType(), payload.getTransferAmount(), payload.getContent());

        // 1. Only process incoming money transactions ("in")
        if (payload.getTransferType() != null && !"in".equalsIgnoreCase(payload.getTransferType().trim())) {
            log.info("Ignored non-incoming transferType: {}", payload.getTransferType());
            return new SepayWebhookResponse(true, "Ignored outgoing or non-incoming transfer");
        }

        BigDecimal transferAmount = payload.getTransferAmount();
        if (transferAmount == null || transferAmount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Invalid transfer amount: {}", transferAmount);
            return new SepayWebhookResponse(false, "Invalid transfer amount");
        }

        String content = payload.getContent();
        if (content == null || content.isBlank()) {
            log.info("Transaction content is blank, ignoring");
            return new SepayWebhookResponse(true, "Empty transaction content");
        }

        // 2. Check Deposit pattern first ("COC SF...")
        Matcher depositMatcher = DEPOSIT_PATTERN.matcher(content);
        if (depositMatcher.find()) {
            Long participantId = Long.parseLong(depositMatcher.group(1));
            return handleDeposit(participantId, transferAmount, payload);
        }

        // 3. Check Final payment pattern ("SF...")
        Matcher finalMatcher = FINAL_PAYMENT_PATTERN.matcher(content);
        if (finalMatcher.find()) {
            Long participantId = Long.parseLong(finalMatcher.group(1));
            return handleFinalPayment(participantId, transferAmount, payload);
        }

        // 4. No matching pattern - return 200 so SePay does not retry indefinitely for personal transfers
        log.info("No SmashFlow code found in content: '{}'", content);
        return new SepayWebhookResponse(true, "No matching payment code in transaction content");
    }

    private SepayWebhookResponse handleDeposit(Long participantId, BigDecimal transferAmount, SepayWebhookPayload payload) {
        SessionParticipant participant = participantRepository.findByIdForUpdate(participantId).orElse(null);
        if (participant == null) {
            log.warn("Deposit webhook: SessionParticipant not found with id={}", participantId);
            return new SepayWebhookResponse(true, "Participant not found: " + participantId);
        }

        if (participant.getSession() != null && participant.getSession().getStatus() == SessionStatus.CANCELLED) {
            log.warn("Deposit webhook: session id={} is cancelled", participant.getSession().getId());
            telegramNotificationService.sendNotification(String.format(
                    "⚠️ <b>[SePay Webhook] Nhận tiền cọc ca đã hủy!</b>\nCa: %s\nKhách: %s (%s)\nSố tiền: %s VNĐ",
                    participant.getSession().getTitle(),
                    participantName(participant),
                    participantPhone(participant),
                    transferAmount.toPlainString()
            ));
            return new SepayWebhookResponse(true, "Session is cancelled");
        }

        // Idempotency: if already paid, accept and exit
        if (participant.getDepositStatus() == DepositStatus.PAID) {
            log.info("Deposit already confirmed for participant id={}", participantId);
            return new SepayWebhookResponse(true, "Deposit already confirmed");
        }

        if (participant.getDepositStatus() != DepositStatus.PENDING) {
            log.warn("Participant id={} has depositStatus={}, cannot confirm", participantId, participant.getDepositStatus());
            return new SepayWebhookResponse(true, "Participant deposit is not pending (status: " + participant.getDepositStatus() + ")");
        }

        BigDecimal requiredDeposit = participant.getDepositAmount() != null
                ? participant.getDepositAmount()
                : (participant.getSession() != null ? participant.getSession().getDepositAmount() : BigDecimal.ZERO);

        // Underpayment check
        if (requiredDeposit != null && transferAmount.compareTo(requiredDeposit) < 0) {
            log.warn("Deposit underpaid for participant id={}: expected={}, actual={}", participantId, requiredDeposit, transferAmount);
            telegramNotificationService.sendNotification(String.format(
                    "⚠️ <b>[SePay CẢNH BÁO THIẾU TIỀN CỌC]</b>\n\n" +
                    "👤 <b>Khách hàng:</b> %s (%s)\n" +
                    "🏸 <b>Ca đánh:</b> %s\n" +
                    "💵 <b>Yêu cầu cọc:</b> %s VNĐ\n" +
                    "⚠️ <b>Thực nhận:</b> %s VNĐ\n" +
                    "📝 <b>Nội dung CK:</b> %s\n" +
                    "<i>Vui lòng liên hệ khách để bổ sung hoặc duyệt thủ công!</i>",
                    participantName(participant),
                    participantPhone(participant),
                    participant.getSession().getTitle(),
                    requiredDeposit.toPlainString(),
                    transferAmount.toPlainString(),
                    payload.getContent()
            ));
            return new SepayWebhookResponse(false, "Transfer amount is less than required deposit");
        }

        // Confirm deposit
        participant.setDepositStatus(DepositStatus.PAID);
        participantRepository.save(participant);

        log.info("Successfully confirmed deposit for participant id={} via SePay", participantId);

        try {
            String msg = String.format(
                    "⚡ <b>[SmashFlow - SePay TỰ ĐỘNG DUYỆT CỌC]</b>\n\n" +
                    "👤 <b>Khách hàng:</b> %s (%s)\n" +
                    "💵 <b>Số tiền cọc:</b> %s VNĐ\n" +
                    "🏸 <b>Ca đánh:</b> %s\n" +
                    "🏦 <b>Ngân hàng:</b> %s (Ref: %s)\n" +
                    "✅ <b>Trạng thái:</b> Tự động duyệt thành công qua SePay!",
                    participantName(participant),
                    participantPhone(participant),
                    transferAmount.toPlainString(),
                    participant.getSession().getTitle(),
                    payload.getGateway() != null ? payload.getGateway() : "N/A",
                    payload.getReferenceCode() != null ? payload.getReferenceCode() : String.valueOf(payload.getId())
            );
            telegramNotificationService.sendNotification(msg);
        } catch (Exception e) {
            log.error("Failed to send Telegram notification", e);
        }

        return new SepayWebhookResponse(true, "Deposit confirmed successfully");
    }

    private SepayWebhookResponse handleFinalPayment(Long participantId, BigDecimal transferAmount, SepayWebhookPayload payload) {
        SessionParticipant participant = participantRepository.findByIdForUpdate(participantId).orElse(null);
        if (participant == null) {
            log.warn("Payment webhook: SessionParticipant not found with id={}", participantId);
            return new SepayWebhookResponse(true, "Participant not found: " + participantId);
        }

        if (participant.getSession() != null && participant.getSession().getStatus() == SessionStatus.CANCELLED) {
            log.warn("Payment webhook: session id={} is cancelled", participant.getSession().getId());
            telegramNotificationService.sendNotification(String.format(
                    "⚠️ <b>[SePay Webhook] Nhận thanh toán cho ca đã hủy!</b>\nCa: %s\nKhách: %s (%s)\nSố tiền: %s VNĐ",
                    participant.getSession().getTitle(),
                    participantName(participant),
                    participantPhone(participant),
                    transferAmount.toPlainString()
            ));
            return new SepayWebhookResponse(true, "Session is cancelled");
        }

        // Idempotency: if already settled, accept and exit
        if (participant.getPaymentStatus() == PaymentStatus.PAID) {
            log.info("Payment already settled for participant id={}", participantId);
            return new SepayWebhookResponse(true, "Payment already settled");
        }

        BigDecimal remaining = participant.getRemainingPaymentAmount();

        // Underpayment check
        if (remaining != null && transferAmount.compareTo(remaining) < 0) {
            log.warn("Final payment underpaid for participant id={}: expected={}, actual={}", participantId, remaining, transferAmount);
            telegramNotificationService.sendNotification(String.format(
                    "⚠️ <b>[SePay CẢNH BÁO THIẾU TIỀN SÂN]</b>\n\n" +
                    "👤 <b>Người chơi:</b> %s (%s)\n" +
                    "🏸 <b>Ca đánh:</b> %s\n" +
                    "💵 <b>Cần thu:</b> %s VNĐ\n" +
                    "⚠️ <b>Thực nhận:</b> %s VNĐ\n" +
                    "📝 <b>Nội dung CK:</b> %s\n" +
                    "<i>Vui lòng kiểm tra lại trước khi xác nhận hoàn tất!</i>",
                    participantName(participant),
                    participantPhone(participant),
                    participant.getSession().getTitle(),
                    remaining.toPlainString(),
                    transferAmount.toPlainString(),
                    payload.getContent()
            ));
            return new SepayWebhookResponse(false, "Transfer amount is less than remaining bill");
        }

        // Settle payment
        participant.setPaymentStatus(PaymentStatus.PAID);
        participant.setPaymentMethod(PaymentMethod.VIETQR);
        participant.setPaidAt(LocalDateTime.now());
        participant.setPaidBy(null); // null indicates automated webhook payment
        participantRepository.save(participant);

        log.info("Successfully settled payment for participant id={} via SePay", participantId);

        try {
            String msg = String.format(
                    "💰 <b>[SmashFlow - SePay TỰ ĐỘNG THU TIỀN SÂN]</b>\n\n" +
                    "👤 <b>Người chơi:</b> %s (%s)\n" +
                    "💵 <b>Số tiền thu:</b> %s VNĐ\n" +
                    "💳 <b>Phương thức:</b> VietQR (SePay Auto)\n" +
                    "🏸 <b>Ca đánh:</b> %s\n" +
                    "🏦 <b>Ngân hàng:</b> %s (Ref: %s)",
                    participantName(participant),
                    participantPhone(participant),
                    transferAmount.toPlainString(),
                    participant.getSession().getTitle(),
                    payload.getGateway() != null ? payload.getGateway() : "N/A",
                    payload.getReferenceCode() != null ? payload.getReferenceCode() : String.valueOf(payload.getId())
            );
            telegramNotificationService.sendNotification(msg);
        } catch (Exception e) {
            log.error("Failed to send Telegram notification", e);
        }

        return new SepayWebhookResponse(true, "Payment settled successfully");
    }

    private static String participantName(SessionParticipant p) {
        return p.getUser() != null && p.getUser().getFullName() != null && !p.getUser().getFullName().isBlank()
                ? p.getUser().getFullName()
                : (p.getGuestName() != null && !p.getGuestName().isBlank() ? p.getGuestName() : "Khách");
    }

    private static String participantPhone(SessionParticipant p) {
        return p.getUser() != null && p.getUser().getPhone() != null && !p.getUser().getPhone().isBlank()
                ? p.getUser().getPhone()
                : (p.getGuestPhone() != null && !p.getGuestPhone().isBlank() ? p.getGuestPhone() : "N/A");
    }
}
