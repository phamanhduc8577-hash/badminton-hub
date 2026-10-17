package com.smashflow.service;

import com.smashflow.model.DepositStatus;
import com.smashflow.model.Gender;
import com.smashflow.model.PaymentStatus;
import com.smashflow.model.Session;
import com.smashflow.model.SessionParticipant;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Công thức giá dùng chung cho mọi nơi tính tiền một lượt đăng ký ca
 * (đăng ký thành viên, đặt công khai, sửa ca, duyệt/hạ cấp thành viên, đổi giới tính, điểm danh gói 2h).
 *
 * Quy tắc giá gốc:
 *  - Hạng giá: thành viên cố định (member) hoặc vãng lai (guest).
 *  - Gói 2 tiếng chỉ áp dụng khi ca có giá 2h NAM của hạng đó; nữ không có giá 2h riêng thì dùng giá nữ full ca.
 *  - Voucher % tính trên giá gốc; điều chỉnh tay của Host (số tiền cố định) giữ nguyên.
 */
public final class PricingCalculator {

    public static final BigDecimal TWO_HOURS = new BigDecimal("2.0");

    /** Host chỉ được hoàn tác thu tiền trong vòng N ngày sau khi ca kết thúc. */
    public static final int UNDO_PAYMENT_WINDOW_DAYS = 7;

    private static final Pattern VOUCHER_PERCENT = Pattern.compile("Voucher\\s+(\\d+)%");

    private PricingCalculator() {
    }

    public static boolean isTwoHours(BigDecimal durationHours) {
        return durationHours != null && durationHours.compareTo(TWO_HOURS) == 0;
    }

    /** Giá gốc theo hạng (member/guest), giới tính và thời lượng. */
    public static BigDecimal baseFee(Session s, boolean memberTier, Gender gender, BigDecimal durationHours) {
        boolean female = gender == Gender.FEMALE;
        boolean is2h = isTwoHours(durationHours);
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

    /** Ca có giá 2h thực sự áp được cho hạng + giới tính này (khác giá full ca theo công thức fallback). */
    public static boolean hasTwoHourPrice(Session s, boolean memberTier, Gender gender) {
        boolean female = gender == Gender.FEMALE;
        if (memberTier) {
            return s.getMemberMalePrice2h() != null && (!female || s.getMemberFemalePrice2h() != null);
        }
        return s.getGuestMalePrice2h() != null && (!female || s.getGuestFemalePrice2h() != null);
    }

    /** Số tiền giảm (âm) của voucher % trên giá gốc. */
    public static BigDecimal voucherDiscount(BigDecimal base, int percent) {
        return base.multiply(BigDecimal.valueOf(percent))
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP)
                .negate();
    }

    /** Voucher % tính lại theo giá gốc mới; điều chỉnh tay (không phải voucher) giữ nguyên. */
    public static BigDecimal recomputeVoucherAdjustment(String reason, BigDecimal newBase, BigDecimal currentAdj) {
        BigDecimal adj = currentAdj != null ? currentAdj : BigDecimal.ZERO;
        if (reason == null) return adj;
        Matcher m = VOUCHER_PERCENT.matcher(reason);
        if (!m.find()) return adj;
        return voucherDiscount(newBase, Integer.parseInt(m.group(1)));
    }

    public static BigDecimal finalFee(BigDecimal base, BigDecimal adjustment) {
        BigDecimal adj = adjustment != null ? adjustment : BigDecimal.ZERO;
        return base.add(adj).max(BigDecimal.ZERO);
    }

    /**
     * Tính lại giá một lượt đăng ký: đặt baseFee mới, tính lại voucher %, giữ điều chỉnh tay.
     * @return false nếu ca chưa cấu hình giá cho hạng/giới tính này (không đổi gì).
     */
    public static boolean reprice(SessionParticipant p, Session s, boolean memberTier, Gender gender, BigDecimal durationHours) {
        BigDecimal newBase = baseFee(s, memberTier, gender, durationHours);
        if (newBase == null) return false;
        p.setBaseFee(newBase);
        BigDecimal adj = recomputeVoucherAdjustment(p.getAdjustmentReason(), newBase, p.getAdjustmentAmount());
        p.setAdjustmentAmount(adj);
        p.setFinalFee(finalFee(newBase, adj));
        return true;
    }

    /** Tiền còn phải thu: chỉ trừ cọc khi Host đã xác nhận nhận cọc (PAID). Đã thanh toán → 0. */
    public static BigDecimal remainingAmount(SessionParticipant p) {
        if (p.getPaymentStatus() == PaymentStatus.PAID) {
            return BigDecimal.ZERO;
        }
        BigDecimal fee = p.getFinalFee() != null ? p.getFinalFee() : BigDecimal.ZERO;
        BigDecimal deposit = (p.getDepositStatus() == DepositStatus.PAID && p.getDepositAmount() != null)
                ? p.getDepositAmount()
                : BigDecimal.ZERO;
        BigDecimal remaining = fee.subtract(deposit);
        return remaining.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : remaining;
    }

    /** Còn trong hạn hoàn tác thu tiền: now ≤ giờ kết thúc ca + 7 ngày. */
    public static boolean withinUndoWindow(Session s, LocalDateTime now) {
        return s != null && s.getEndTime() != null
                && !now.isAfter(s.getEndTime().plusDays(UNDO_PAYMENT_WINDOW_DAYS));
    }

    /** Lượt đã thu tiền (không phải lượt giữ cọc do vắng) và còn trong hạn 7 ngày. */
    public static boolean canUndoPayment(SessionParticipant p, LocalDateTime now) {
        return p.getPaymentStatus() == PaymentStatus.PAID
                && p.getDepositStatus() != DepositStatus.FORFEITED
                && withinUndoWindow(p.getSession(), now);
    }

    /** Giá full ca (thành viên/vãng lai × nam/nữ) bắt buộc có và không âm; giá 2h nếu có thì không âm. */
    public static void validateSessionPrices(BigDecimal memberMale, BigDecimal memberFemale,
                                             BigDecimal guestMale, BigDecimal guestFemale,
                                             BigDecimal... twoHourPrices) {
        for (BigDecimal v : new BigDecimal[]{memberMale, memberFemale, guestMale, guestFemale}) {
            if (v == null || v.compareTo(BigDecimal.ZERO) < 0) {
                throw new RuntimeException("Giá full ca (Thành viên / Vãng lai, Nam / Nữ) không được để trống hoặc âm!");
            }
        }
        for (BigDecimal v : twoHourPrices) {
            if (v != null && v.compareTo(BigDecimal.ZERO) < 0) {
                throw new RuntimeException("Giá gói 2 tiếng không được âm!");
            }
        }
    }
}
