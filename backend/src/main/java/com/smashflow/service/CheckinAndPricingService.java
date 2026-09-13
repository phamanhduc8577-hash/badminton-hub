package com.smashflow.service;

import com.smashflow.dto.CheckinRequest;
import com.smashflow.dto.HostOverrideRequest;
import com.smashflow.dto.ParticipantResponse;
import com.smashflow.dto.SettlePaymentRequest;
import com.smashflow.model.*;
import com.smashflow.repository.LoyaltyRewardRepository;
import com.smashflow.repository.SessionParticipantRepository;
import com.smashflow.repository.SessionRepository;
import com.smashflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CheckinAndPricingService {

    private final SessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final UserRepository userRepository;
    private final LoyaltyRewardRepository loyaltyRewardRepository;
    private final GeoLocationService geoLocationService;
    private final TelegramNotificationService telegramNotificationService;

    @Transactional
    public ParticipantResponse memberCheckin(Long sessionId, User user, CheckinRequest request) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca đánh!"));

        // 1. Verify Dynamic QR Token
        if (!session.getCheckinToken().equalsIgnoreCase(request.getToken())) {
            throw new RuntimeException("Mã QR điểm danh không chính xác!");
        }

        // Check token expiration (15 mins)
        if (session.getTokenExpiresAt() != null && LocalDateTime.now().isAfter(session.getTokenExpiresAt())) {
            throw new RuntimeException("Mã QR điểm danh đã hết hạn (quá 15 phút)! Vui lòng gặp Host để điểm danh.");
        }

        // 2. Find participant (Strictly check user registration in this session)
        SessionParticipant participant = participantRepository.findBySessionIdAndUserId(sessionId, user.getId())
                .orElseThrow(() -> new RuntimeException("Bạn chưa đăng ký tham gia ca đánh này!"));

        // Check if first-time guest still has pending deposit
        if (participant.getDepositStatus() == DepositStatus.PENDING) {
            throw new RuntimeException("Bạn chưa hoàn tất chuyển khoản cọc hoặc Host chưa duyệt cọc! Vui lòng chờ Host xác nhận.");
        }

        if (participant.getCheckinStatus() == CheckinStatus.CHECKED_IN) {
            throw new RuntimeException("Bạn đã điểm danh ca này rồi!");
        }

        participant.setCheckinStatus(CheckinStatus.CHECKED_IN);
        participant.setCheckinAt(LocalDateTime.now());
        participantRepository.save(participant);

        // 3. Update user session attendance & trigger Loyalty
        user.setSessionsAttended(user.getSessionsAttended() + 1);
        userRepository.save(user);

        checkAndGrantLoyaltyRewards(user);

        return toParticipantResponse(participant);
    }

    @Transactional
    public ParticipantResponse hostCheckinManual(Long participantId) {
        SessionParticipant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        if (participant.getCheckinStatus() == CheckinStatus.CHECKED_IN) {
            throw new RuntimeException("Người này đã điểm danh rồi!");
        }

        participant.setCheckinStatus(CheckinStatus.CHECKED_IN);
        participant.setCheckinAt(LocalDateTime.now());
        participantRepository.save(participant);

        if (participant.getUser() != null) {
            User user = participant.getUser();
            user.setSessionsAttended((user.getSessionsAttended() != null ? user.getSessionsAttended() : 0) + 1);
            userRepository.save(user);
            checkAndGrantLoyaltyRewards(user);
        }

        return toParticipantResponse(participant);
    }

    @Transactional
    public ParticipantResponse hostOverrideBill(HostOverrideRequest request) {
        SessionParticipant participant = participantRepository.findById(request.getParticipantId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        if (request.getOverrideFinalFee() != null) {
            participant.setFinalFee(request.getOverrideFinalFee());
        } else if (request.getAdjustmentAmount() != null) {
            participant.setAdjustmentAmount(request.getAdjustmentAmount());
            participant.setFinalFee(participant.getBaseFee().add(request.getAdjustmentAmount()));
        }

        if (request.getAdjustmentReason() != null) {
            participant.setAdjustmentReason(request.getAdjustmentReason());
        }

        participantRepository.save(participant);
        return toParticipantResponse(participant);
    }

    @Transactional
    public ParticipantResponse settlePayment(SettlePaymentRequest request) {
        SessionParticipant participant = participantRepository.findById(request.getParticipantId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        participant.setPaymentStatus(PaymentStatus.PAID);
        participant.setPaymentMethod(request.getPaymentMethod());

        // Tự động chuyển trạng thái cọc sang PAID nếu trước đó đang chờ duyệt cọc
        if (participant.getDepositStatus() == DepositStatus.PENDING) {
            participant.setDepositStatus(DepositStatus.PAID);
        }

        participantRepository.save(participant);

        try {
            String pName = participant.getUser() != null ? participant.getUser().getFullName() : participant.getGuestName();
            String pPhone = participant.getUser() != null ? participant.getUser().getPhone() : participant.getGuestPhone();
            String methodStr = request.getPaymentMethod() == PaymentMethod.CASH ? "Tiền mặt tại sân" : "VietQR Chuyển khoản";
            telegramNotificationService.notifyPaymentSettled(
                    participant.getSession().getTitle(),
                    pName,
                    pPhone,
                    participant.getFinalFee().toString(),
                    methodStr
            );
        } catch (Exception ignored) {}

        return toParticipantResponse(participant);
    }

    @Transactional
    public ParticipantResponse selectPaymentMethod(Long participantId, User user, PaymentMethod method) {
        SessionParticipant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        // Bảo mật: Nếu có user đăng nhập và không phải HOST, chỉ được chọn phương thức thanh toán cho chính mình
        if (user != null && user.getRole() != Role.HOST) {
            if (participant.getUser() == null || !participant.getUser().getId().equals(user.getId())) {
                throw new RuntimeException("Bạn không có quyền thay đổi thông tin thanh toán của người khác!");
            }
        }

        participant.setPaymentMethod(method);
        participantRepository.save(participant);
        return toParticipantResponse(participant);
    }

    private void checkAndGrantLoyaltyRewards(User user) {
        List<Integer> milestones = Arrays.asList(5, 10, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100);
        int attended = user.getSessionsAttended();

        for (Integer m : milestones) {
            if (attended >= m && loyaltyRewardRepository.findByUserIdAndMilestoneSessions(user.getId(), m).isEmpty()) {
                String rewardName = LoyaltyRewardService.getRewardNameForMilestone(m);

                LoyaltyReward reward = LoyaltyReward.builder()
                        .user(user)
                        .milestoneSessions(m)
                        .rewardName(rewardName)
                        .isClaimed(false)
                        .build();

                loyaltyRewardRepository.save(reward);
            }
        }
    }

    private ParticipantResponse toParticipantResponse(SessionParticipant p) {
        String name = (p.getUser() != null && p.getUser().getFullName() != null && !p.getUser().getFullName().isBlank())
                ? p.getUser().getFullName()
                : (p.getGuestName() != null && !p.getGuestName().isBlank() ? p.getGuestName() : "N/A");

        String phone = (p.getUser() != null && p.getUser().getPhone() != null && !p.getUser().getPhone().isBlank())
                ? p.getUser().getPhone()
                : (p.getGuestPhone() != null && !p.getGuestPhone().isBlank() ? p.getGuestPhone() : "N/A");

        return ParticipantResponse.builder()
                .id(p.getId())
                .sessionId(p.getSession().getId())
                .userId(p.getUser() != null ? p.getUser().getId() : null)
                .isGuest(p.getIsGuest())
                .name(name)
                .phone(phone)
                .gender(p.getGender())
                .durationHours(p.getDurationHours())
                .slotWindow(p.getSlotWindow())
                .checkinStatus(p.getCheckinStatus())
                .checkinAt(p.getCheckinAt())
                .depositStatus(p.getDepositStatus())
                .depositAmount(p.getDepositAmount())
                .baseFee(p.getBaseFee())
                .adjustmentAmount(p.getAdjustmentAmount())
                .adjustmentReason(p.getAdjustmentReason())
                .finalFee(p.getFinalFee())
                .remainingAmount(p.getRemainingPaymentAmount())
                .paymentStatus(p.getPaymentStatus())
                .paymentMethod(p.getPaymentMethod())
                .winCount(p.getUser() != null ? p.getUser().getWinCount() : 0)
                .lossCount(p.getUser() != null ? p.getUser().getLossCount() : 0)
                .eloScore(p.getUser() != null ? p.getUser().getEloScore() : 0)
                .placementMatches(p.getUser() != null ? (p.getUser().getPlacementMatches() != null ? p.getUser().getPlacementMatches() : 0) : 0)
                .currentStreak(p.getUser() != null ? (p.getUser().getCurrentStreak() != null ? p.getUser().getCurrentStreak() : 0) : 0)
                .shieldMatches(p.getUser() != null ? (p.getUser().getShieldMatches() != null ? p.getUser().getShieldMatches() : 0) : 0)
                .build();
    }
}
