package com.smashflow.service;

import com.smashflow.model.*;
import com.smashflow.repository.SessionParticipantRepository;
import com.smashflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Nghiệp vụ đổi giới tính (ảnh hưởng trực tiếp tới giá ca & ghép trận cân bằng nam/nữ).
 *
 * Quy tắc:
 *  - Thành viên chỉ được TỰ sửa khi tài khoản chưa "phát sinh lịch sử": chưa điểm danh ca nào,
 *    chưa có trận thắng/thua, chưa thanh toán / đặt cọc ca nào. Sau đó chỉ Host được sửa.
 *  - Khi đổi: các lượt đăng ký CHƯA THANH TOÁN (ca chưa hủy, không vắng mặt) được tính lại giá
 *    theo giới tính mới. Lượt đã thanh toán giữ nguyên làm lịch sử đối soát.
 */
@Service
@RequiredArgsConstructor
public class GenderChangeService {

    private static final Pattern VOUCHER_PERCENT = Pattern.compile("Voucher\\s+(\\d+)%");

    private final UserRepository userRepository;
    private final SessionParticipantRepository participantRepository;
    private final TelegramNotificationService telegramNotificationService;

    /** true = thành viên KHÔNG còn được tự sửa giới tính (phải nhờ Host). */
    public boolean isSelfEditLocked(User user) {
        if (user == null || user.getId() == null) return true;
        if (nz(user.getSessionsAttended()) > 0) return true;
        if (nz(user.getWinCount()) + nz(user.getLossCount()) > 0) return true;
        List<SessionParticipant> participations = participantRepository.findByUserId(user.getId());
        for (SessionParticipant p : participations) {
            if (p.getCheckinStatus() == CheckinStatus.CHECKED_IN || p.getCheckinStatus() == CheckinStatus.LATE) return true;
            if (p.getPaymentStatus() == PaymentStatus.PAID) return true;
            DepositStatus d = p.getDepositStatus();
            if (d == DepositStatus.PAID || d == DepositStatus.FORFEITED || d == DepositStatus.REFUNDED) return true;
        }
        return false;
    }

    /** Thành viên tự đổi giới tính trong hồ sơ. */
    @Transactional
    public int changeBySelf(User user, Gender newGender) {
        validateGender(newGender);
        if (user.getGender() == newGender) return 0;
        if (isSelfEditLocked(user)) {
            throw new RuntimeException("Bạn đã tham gia/thanh toán ca đánh nên không thể tự đổi giới tính. Vui lòng liên hệ Host để được chỉnh sửa!");
        }
        Gender oldGender = user.getGender();
        int repriced = applyChange(user, newGender);
        try {
            telegramNotificationService.sendNotification(String.format(
                    "✏️ <b>[SmashFlow] THÀNH VIÊN ĐỔI GIỚI TÍNH</b>\n\n👤 %s (%s)\n🔄 %s → %s\n💸 Đã tính lại giá %d lượt đăng ký chưa thanh toán",
                    escapeHtml(user.getFullName()), escapeHtml(user.getPhone()),
                    label(oldGender), label(newGender), repriced));
        } catch (Exception ignored) {}
        return repriced;
    }

    /** Host đổi giới tính cho bất kỳ thành viên nào (không giới hạn lịch sử). */
    @Transactional
    public User changeByHost(Long userId, Gender newGender) {
        validateGender(newGender);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên!"));
        if (user.getGender() != newGender) {
            applyChange(user, newGender);
        }
        return user;
    }

    private int applyChange(User user, Gender newGender) {
        user.setGender(newGender);
        userRepository.save(user);

        int repriced = 0;
        for (SessionParticipant p : participantRepository.findByUserId(user.getId())) {
            if (p.getPaymentStatus() == PaymentStatus.PAID) continue;
            if (p.getCheckinStatus() == CheckinStatus.ABSENT) continue;
            Session s = p.getSession();
            if (s == null || s.getStatus() == SessionStatus.CANCELLED) continue;

            p.setGender(newGender);
            BigDecimal newBase = resolveBaseFee(s, !Boolean.TRUE.equals(p.getIsGuest()), newGender, p.getDurationHours());
            if (newBase != null) {
                p.setBaseFee(newBase);
                BigDecimal adj = recomputeVoucherAdjustment(p.getAdjustmentReason(), newBase, p.getAdjustmentAmount());
                p.setAdjustmentAmount(adj);
                p.setFinalFee(newBase.add(adj).max(BigDecimal.ZERO));
            }
            participantRepository.save(p);
            repriced++;
        }
        return repriced;
    }

    /** Cùng công thức với SessionService.memberJoinSession / bookPublicSlot. */
    static BigDecimal resolveBaseFee(Session s, boolean memberTier, Gender gender, BigDecimal durationHours) {
        boolean female = gender == Gender.FEMALE;
        boolean is2h = durationHours != null && durationHours.compareTo(new BigDecimal("2.0")) == 0;
        if (memberTier) {
            if (is2h && s.getMemberMalePrice2h() != null) {
                return female
                        ? (s.getMemberFemalePrice2h() != null ? s.getMemberFemalePrice2h() : s.getMemberFemalePrice())
                        : s.getMemberMalePrice2h();
            }
            return female ? s.getMemberFemalePrice() : s.getMemberMalePrice();
        }
        if (is2h && s.getGuestMalePrice2h() != null) {
            return female
                    ? (s.getGuestFemalePrice2h() != null ? s.getGuestFemalePrice2h() : s.getGuestFemalePrice())
                    : s.getGuestMalePrice2h();
        }
        return female ? s.getGuestFemalePrice() : s.getGuestMalePrice();
    }

    /** Voucher % tính theo giá gốc nên phải tính lại; điều chỉnh tay của Host (số tiền cố định) giữ nguyên. */
    static BigDecimal recomputeVoucherAdjustment(String reason, BigDecimal newBase, BigDecimal currentAdj) {
        BigDecimal adj = currentAdj != null ? currentAdj : BigDecimal.ZERO;
        if (reason == null) return adj;
        Matcher m = VOUCHER_PERCENT.matcher(reason);
        if (!m.find()) return adj;
        int percent = Integer.parseInt(m.group(1));
        return newBase.multiply(BigDecimal.valueOf(percent))
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP)
                .negate();
    }

    private static void validateGender(Gender g) {
        if (g != Gender.MALE && g != Gender.FEMALE) {
            throw new RuntimeException("Giới tính không hợp lệ! Vui lòng chọn Nam hoặc Nữ.");
        }
    }

    private static String label(Gender g) {
        return g == Gender.FEMALE ? "Nữ" : "Nam";
    }

    private static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static int nz(Integer v) {
        return v != null ? v : 0;
    }
}
