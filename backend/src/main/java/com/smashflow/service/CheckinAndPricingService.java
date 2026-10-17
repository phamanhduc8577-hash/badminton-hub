package com.smashflow.service;

import com.smashflow.dto.CancelCheckinResponse;
import com.smashflow.dto.CheckinRequest;
import com.smashflow.dto.HostOverrideRequest;
import com.smashflow.dto.ParticipantResponse;
import com.smashflow.dto.SettlePaymentRequest;
import com.smashflow.model.*;
import com.smashflow.repository.SessionParticipantRepository;
import com.smashflow.repository.SessionRepository;
import com.smashflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CheckinAndPricingService {

    /** Mở tự điểm danh trước giờ bắt đầu ca bao nhiêu phút (Q4). */
    static final long SELF_CHECKIN_OPEN_BEFORE_MINUTES = 30;

    private final SessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final UserRepository userRepository;
    private final LoyaltyRewardService loyaltyRewardService;
    private final GeoLocationService geoLocationService;
    private final TelegramNotificationService telegramNotificationService;

    @Transactional
    public ParticipantResponse memberCheckin(Long sessionId, User user, CheckinRequest request) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca đánh!"));

        if (session.getStatus() == SessionStatus.CANCELLED) {
            throw new RuntimeException("Ca này đã bị hủy, không thể điểm danh!");
        }

        // 1. Verify Dynamic QR Token
        if (session.getCheckinToken() == null || !session.getCheckinToken().equalsIgnoreCase(request.getToken())) {
            throw new RuntimeException("Mã QR điểm danh không chính xác!");
        }

        // 2. Cửa sổ tự điểm danh theo giờ ca (Q4): từ 30 phút trước giờ bắt đầu tới hết ca
        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(session.getStartTime().minusMinutes(SELF_CHECKIN_OPEN_BEFORE_MINUTES))) {
            throw new RuntimeException("Chưa tới giờ điểm danh (mở trước giờ bắt đầu 30 phút)!");
        }
        if (now.isAfter(session.getEndTime())) {
            throw new RuntimeException("Ca đã kết thúc, vui lòng gặp Host để điểm danh!");
        }

        // 3. Tìm lượt đăng ký rồi khóa dòng: bấm đúp / request song song phải chờ nhau
        Long participantId = participantRepository.findBySessionIdAndUserId(sessionId, user.getId())
                .orElseThrow(() -> new RuntimeException("Bạn chưa đăng ký tham gia ca đánh này!"))
                .getId();
        SessionParticipant participant = participantRepository.findByIdForUpdate(participantId)
                .orElseThrow(() -> new RuntimeException("Bạn chưa đăng ký tham gia ca đánh này!"));

        if (participant.getCheckinStatus() == CheckinStatus.ABSENT) {
            throw new RuntimeException("Lượt đăng ký này đã bị đánh vắng, vui lòng gặp Host!");
        }

        // Check if first-time guest still has pending deposit
        if (participant.getDepositStatus() == DepositStatus.PENDING) {
            throw new RuntimeException("Bạn chưa hoàn tất chuyển khoản cọc hoặc Host chưa duyệt cọc! Vui lòng chờ Host xác nhận.");
        }

        if (participant.getCheckinStatus() == CheckinStatus.CHECKED_IN) {
            throw new RuntimeException("Bạn đã điểm danh ca này rồi!");
        }

        // Khóa dòng user và nạp lại trong transaction (không ghi đè dữ liệu bằng principal cũ trong token)
        userRepository.lockRowById(user.getId());
        User managedUser = userRepository.findById(user.getId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản!"));

        // 4. "Chỉ đánh 2 tiếng" lúc điểm danh: áp giá 2h nếu ca có giá 2h cho hạng này và lượt chưa thanh toán
        if (request != null && PricingCalculator.isTwoHours(request.getDurationHours())
                && participant.getPaymentStatus() != PaymentStatus.PAID) {
            boolean memberTier = !Boolean.TRUE.equals(participant.getIsGuest());
            if (PricingCalculator.hasTwoHourPrice(session, memberTier, participant.getGender())) {
                participant.setDurationHours(PricingCalculator.TWO_HOURS);
                PricingCalculator.reprice(participant, session, memberTier, participant.getGender(), PricingCalculator.TWO_HOURS);
            }
        }

        participant.setCheckinStatus(CheckinStatus.CHECKED_IN);
        participant.setCheckinAt(now);
        participantRepository.saveAndFlush(participant);

        // 5. Số buổi tính lại từ dữ liệu điểm danh (giống luồng Host), rồi xét quà chuyên cần
        int attended = recalculateAttendance(managedUser);
        loyaltyRewardService.grantEligibleRewards(managedUser, attended);

        return PhoneMasking.maskForViewer(toParticipantResponse(participant), managedUser);
    }

    @Transactional
    public ParticipantResponse hostCheckinManual(Long participantId) {
        // Khóa dòng người tham gia ngay từ đầu: bấm đúp / request song song sẽ phải chờ nhau
        SessionParticipant participant = participantRepository.findByIdForUpdate(participantId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        if (participant.getCheckinStatus() == CheckinStatus.CHECKED_IN) {
            throw new RuntimeException("Người này đã điểm danh rồi!");
        }
        ensureSessionNotCancelled(participant, "Ca này đã bị hủy, không thể điểm danh!");

        User user = participant.getUser();
        if (user != null) {
            // Khóa dòng thành viên để các lần điểm danh khác của cùng người này chạy tuần tự
            userRepository.lockRowById(user.getId());
        }

        participant.setCheckinStatus(CheckinStatus.CHECKED_IN);
        participant.setCheckinAt(LocalDateTime.now());
        participantRepository.saveAndFlush(participant);

        if (user != null) {
            int attended = recalculateAttendance(user);
            loyaltyRewardService.grantEligibleRewards(user, attended);
        }

        return toParticipantResponse(participant);
    }

    /** Host hủy điểm danh (ví dụ bấm nhầm): trả về chưa điểm danh, tính lại số buổi và thu hồi quà chưa trao. */
    @Transactional
    public CancelCheckinResponse hostCancelCheckin(Long participantId) {
        SessionParticipant participant = participantRepository.findByIdForUpdate(participantId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        if (participant.getCheckinStatus() != CheckinStatus.CHECKED_IN) {
            throw new RuntimeException("Người này chưa được điểm danh nên không cần hủy!");
        }

        User user = participant.getUser();
        if (user != null) {
            userRepository.lockRowById(user.getId());
        }

        participant.setCheckinStatus(CheckinStatus.PENDING);
        participant.setCheckinAt(null);
        participantRepository.saveAndFlush(participant);

        List<String> notes = new ArrayList<>();
        if (user != null) {
            int attended = recalculateAttendance(user);
            notes.addAll(loyaltyRewardService.revokeIneligibleRewards(user, attended));
        }

        return CancelCheckinResponse.builder()
                .participant(toParticipantResponse(participant))
                .notes(notes)
                .build();
    }

    /** Số buổi = số ca khác nhau đã điểm danh. Phải gọi sau khi đã khóa dòng user và flush trạng thái điểm danh. */
    private int recalculateAttendance(User user) {
        int attended = (int) participantRepository.countDistinctCheckedInSessions(user.getId());
        user.setSessionsAttended(attended);
        userRepository.save(user);
        return attended;
    }

    @Transactional
    public ParticipantResponse hostOverrideBill(HostOverrideRequest request) {
        SessionParticipant participant = participantRepository.findByIdForUpdate(request.getParticipantId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        if (participant.getPaymentStatus() == PaymentStatus.PAID) {
            throw new RuntimeException("Lượt đã thanh toán, vui lòng hoàn tác thu tiền trước khi sửa!");
        }

        BigDecimal newBase = request.getOverrideBaseFee() != null ? request.getOverrideBaseFee() : participant.getBaseFee();
        if (newBase == null || newBase.compareTo(BigDecimal.ZERO) < 0) {
            throw new RuntimeException("Giá gốc không được âm!");
        }
        BigDecimal newAdj = participant.getAdjustmentAmount() != null ? participant.getAdjustmentAmount() : BigDecimal.ZERO;

        BigDecimal newFinal;
        if (request.getOverrideFinalFee() != null) {
            newFinal = request.getOverrideFinalFee();
        } else if (request.getAdjustmentAmount() != null) {
            newAdj = request.getAdjustmentAmount();
            newFinal = newBase.add(newAdj);
        } else if (request.getOverrideBaseFee() != null) {
            newFinal = newBase.add(newAdj);
        } else {
            newFinal = participant.getFinalFee();
        }

        if (newFinal == null || newFinal.compareTo(BigDecimal.ZERO) < 0) {
            throw new RuntimeException("Số tiền phải thu sau điều chỉnh không được âm!");
        }

        participant.setBaseFee(newBase);
        participant.setAdjustmentAmount(newAdj);
        participant.setFinalFee(newFinal);

        if (request.getAdjustmentReason() != null) {
            participant.setAdjustmentReason(request.getAdjustmentReason());
        }

        participantRepository.save(participant);
        return toParticipantResponse(participant);
    }

    @Transactional
    public ParticipantResponse settlePayment(SettlePaymentRequest request, User host) {
        // Khóa dòng: bấm "Đã thu" 2 lần / 2 máy cùng bấm không được ghi nhận 2 lần
        SessionParticipant participant = participantRepository.findByIdForUpdate(request.getParticipantId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        if (participant.getPaymentStatus() == PaymentStatus.PAID) {
            throw new RuntimeException("Lượt này đã thanh toán rồi!");
        }
        ensureSessionNotCancelled(participant, "Ca này đã bị hủy, không thể thu tiền!");

        // Số tiền thu = tiền còn lại theo cọc THỰC NHẬN (tính trước khi đổi trạng thái).
        // Không tự đổi trạng thái cọc: cọc PENDING vẫn là PENDING (chưa nhận) nên không được trừ.
        BigDecimal collected = participant.getRemainingPaymentAmount();

        participant.setPaymentStatus(PaymentStatus.PAID);
        participant.setPaymentMethod(request.getPaymentMethod());
        participant.setPaidAt(LocalDateTime.now());
        participant.setPaidBy(host != null ? host.getId() : null);

        participantRepository.save(participant);

        try {
            String methodStr = request.getPaymentMethod() == PaymentMethod.CASH ? "Tiền mặt tại sân" : "VietQR Chuyển khoản";
            telegramNotificationService.notifyPaymentSettled(
                    participant.getSession().getTitle(),
                    participantName(participant),
                    participantPhone(participant),
                    collected.toPlainString(),
                    methodStr
            );
        } catch (Exception ignored) {}

        return toParticipantResponse(participant);
    }

    /** Host hoàn tác "Đã thu" (bấm nhầm) — chỉ trong 7 ngày sau khi ca kết thúc, bắt buộc lý do (Q3). */
    @Transactional
    public ParticipantResponse undoPayment(Long participantId, String reason, User host) {
        if (reason == null || reason.isBlank()) {
            throw new RuntimeException("Vui lòng nhập lý do hoàn tác!");
        }

        SessionParticipant participant = participantRepository.findByIdForUpdate(participantId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        if (participant.getPaymentStatus() != PaymentStatus.PAID) {
            throw new RuntimeException("Lượt này chưa thanh toán!");
        }
        if (participant.getDepositStatus() == DepositStatus.FORFEITED) {
            throw new RuntimeException("Lượt này đã bị giữ cọc do vắng mặt, không thể hoàn tác thu tiền!");
        }
        if (!PricingCalculator.withinUndoWindow(participant.getSession(), LocalDateTime.now())) {
            throw new RuntimeException("Chỉ hoàn tác được trong 7 ngày sau khi ca kết thúc!");
        }

        participant.setPaymentStatus(PaymentStatus.UNPAID);
        participant.setPaymentMethod(null);
        participant.setPaidAt(null);
        participant.setPaidBy(null);
        participantRepository.save(participant);

        try {
            telegramNotificationService.notifyPaymentUndone(
                    participant.getSession().getTitle(),
                    participantName(participant),
                    participantPhone(participant),
                    participant.getFinalFee().toPlainString(),
                    reason.trim(),
                    host != null ? host.getFullName() : "Host"
            );
        } catch (Exception ignored) {}

        return toParticipantResponse(participant);
    }

    private static void ensureSessionNotCancelled(SessionParticipant p, String message) {
        if (p.getSession() != null && p.getSession().getStatus() == SessionStatus.CANCELLED) {
            throw new RuntimeException(message);
        }
    }

    private static String participantName(SessionParticipant p) {
        return p.getUser() != null ? p.getUser().getFullName() : p.getGuestName();
    }

    private static String participantPhone(SessionParticipant p) {
        return p.getUser() != null ? p.getUser().getPhone() : p.getGuestPhone();
    }

    @Transactional
    public ParticipantResponse selectPaymentMethod(Long participantId, User user, PaymentMethod method) {
        SessionParticipant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        // Bảo mật: Nếu không phải HOST, chỉ được chọn phương thức thanh toán cho chính mình
        if (user == null) {
            throw new org.springframework.security.access.AccessDeniedException("Bạn cần đăng nhập!");
        }
        if (user.getRole() != Role.HOST) {
            if (participant.getUser() == null || !participant.getUser().getId().equals(user.getId())) {
                throw new RuntimeException("Bạn không có quyền thay đổi thông tin thanh toán của người khác!");
            }
        }

        participant.setPaymentMethod(method);
        participantRepository.save(participant);
        return PhoneMasking.maskForViewer(toParticipantResponse(participant), user);
    }

    /**
     * Trả SĐT đầy đủ. Chỉ trả thẳng cho API của Host; với người xem khác phải đi qua
     * {@link PhoneMasking#maskForViewer(ParticipantResponse, User)}.
     */
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
                .paidAt(p.getPaidAt())
                .canUndoPayment(PricingCalculator.canUndoPayment(p, LocalDateTime.now()))
                .winCount(p.getUser() != null ? p.getUser().getWinCount() : 0)
                .lossCount(p.getUser() != null ? p.getUser().getLossCount() : 0)
                .eloScore(p.getUser() != null ? p.getUser().getEloScore() : 0)
                .placementMatches(p.getUser() != null ? (p.getUser().getPlacementMatches() != null ? p.getUser().getPlacementMatches() : 0) : 0)
                .currentStreak(p.getUser() != null ? (p.getUser().getCurrentStreak() != null ? p.getUser().getCurrentStreak() : 0) : 0)
                .shieldMatches(p.getUser() != null ? (p.getUser().getShieldMatches() != null ? p.getUser().getShieldMatches() : 0) : 0)
                .build();
    }
}
