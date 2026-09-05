package com.smashflow.service;

import com.smashflow.dto.PaymentWebhookPayload;
import com.smashflow.model.DepositStatus;
import com.smashflow.model.PaymentMethod;
import com.smashflow.model.PaymentStatus;
import com.smashflow.model.SessionParticipant;
import com.smashflow.repository.SessionParticipantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentWebhookService {

    private final SessionParticipantRepository participantRepository;
    private final TelegramNotificationService telegramNotificationService;

    // Matches: "COC <sessionId> <phone>" or "PAY <sessionId> <phone>"
    private static final Pattern MEMO_PATTERN = Pattern.compile("(COC|PAY)\\s+(\\d+)\\s+([0-9]{10})", Pattern.CASE_INSENSITIVE);

    @Transactional
    public String processBankWebhook(PaymentWebhookPayload payload) {
        if (payload == null || payload.getContent() == null || payload.getTransferAmount() == null) {
            return "Ignored: Empty memo or amount";
        }

        String memo = payload.getContent().trim();
        Matcher matcher = MEMO_PATTERN.matcher(memo);

        if (!matcher.find()) {
            return "Ignored: Memo does not match SmashFlow syntax";
        }

        String type = matcher.group(1).toUpperCase();
        Long sessionId = Long.parseLong(matcher.group(2));
        String phone = matcher.group(3);
        BigDecimal amount = payload.getTransferAmount();

        List<SessionParticipant> participants = participantRepository.findBySessionId(sessionId);
        SessionParticipant target = participants.stream()
                .filter(p -> {
                    String pPhone = p.getIsGuest()
                            ? p.getGuestPhone()
                            : (p.getUser() != null ? p.getUser().getPhone() : "");
                    return phone.equals(pPhone);
                })
                .findFirst()
                .orElse(null);

        if (target == null) {
            return "Ignored: No matching participant found for session " + sessionId + " and phone " + phone;
        }

        if ("COC".equals(type)) {
            // Auto approve deposit
            if (target.getDepositStatus() != DepositStatus.PAID) {
                target.setDepositStatus(DepositStatus.PAID);
                if (target.getDepositAmount() == null || target.getDepositAmount().compareTo(BigDecimal.ZERO) == 0) {
                    target.setDepositAmount(amount);
                }
                participantRepository.save(target);
                log.info("Auto approved deposit for participant id={} phone={}", target.getId(), phone);

                try {
                    String pName = target.getUser() != null ? target.getUser().getFullName() : target.getGuestName();
                    telegramNotificationService.notifyDepositReceived(target.getSession().getTitle(), pName, phone, amount.toString());
                } catch (Exception ignored) {}

                return "Success: Auto-confirmed deposit of " + amount + " VND";
            }
            return "Already paid deposit";
        } else if ("PAY".equals(type)) {
            // Auto settle final payment
            target.setPaymentStatus(PaymentStatus.PAID);
            target.setPaymentMethod(PaymentMethod.VIETQR);
            participantRepository.save(target);
            log.info("Auto settled final payment for participant id={} phone={}", target.getId(), phone);

            try {
                String pName = target.getUser() != null ? target.getUser().getFullName() : target.getGuestName();
                telegramNotificationService.notifyPaymentSettled(target.getSession().getTitle(), pName, phone, amount.toString(), "VietQR Auto-Bank");
            } catch (Exception ignored) {}

            return "Success: Auto-settled final payment of " + amount + " VND";
        }

        return "Unhandled type: " + type;
    }
}
