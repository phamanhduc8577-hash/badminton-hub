package com.smashflow.service;

import com.smashflow.model.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class PricingCalculatorTest {

    private static final BigDecimal TWO = new BigDecimal("2.0");

    private static Session fullSession() {
        return Session.builder()
                .memberMalePrice(new BigDecimal("50000")).memberFemalePrice(new BigDecimal("40000"))
                .guestMalePrice(new BigDecimal("60000")).guestFemalePrice(new BigDecimal("50000"))
                .memberMalePrice2h(new BigDecimal("35000")).memberFemalePrice2h(new BigDecimal("30000"))
                .guestMalePrice2h(new BigDecimal("45000")).guestFemalePrice2h(new BigDecimal("38000"))
                .build();
    }

    private static Session noTwoHourSession() {
        Session s = fullSession();
        s.setMemberMalePrice2h(null);
        s.setMemberFemalePrice2h(null);
        s.setGuestMalePrice2h(null);
        s.setGuestFemalePrice2h(null);
        return s;
    }

    @ParameterizedTest(name = "member={0} gender={1} 2h={2} → {3}")
    @DisplayName("Ma trận giá: thành viên/vãng lai × nam/nữ × full/2h")
    @CsvSource({
            "true,  MALE,   false, 50000",
            "true,  FEMALE, false, 40000",
            "false, MALE,   false, 60000",
            "false, FEMALE, false, 50000",
            "true,  MALE,   true,  35000",
            "true,  FEMALE, true,  30000",
            "false, MALE,   true,  45000",
            "false, FEMALE, true,  38000",
    })
    void matrix(boolean member, Gender gender, boolean twoHours, String expected) {
        BigDecimal fee = PricingCalculator.baseFee(fullSession(), member, gender, twoHours ? TWO : null);
        assertEquals(0, new BigDecimal(expected).compareTo(fee));
    }

    @ParameterizedTest(name = "không có giá 2h: member={0} gender={1} → {2}")
    @DisplayName("Ca không có giá 2h → chọn 2h vẫn tính giá full ca")
    @CsvSource({
            "true,  MALE,   50000",
            "true,  FEMALE, 40000",
            "false, MALE,   60000",
            "false, FEMALE, 50000",
    })
    void noTwoHourFallsBackToFull(boolean member, Gender gender, String expected) {
        assertEquals(0, new BigDecimal(expected).compareTo(PricingCalculator.baseFee(noTwoHourSession(), member, gender, TWO)));
        assertFalse(PricingCalculator.hasTwoHourPrice(noTwoHourSession(), member, gender));
    }

    @Test
    @DisplayName("Có giá 2h nam nhưng thiếu giá 2h nữ → nữ dùng giá full ca nữ, và không coi là có giá 2h")
    void femaleMissingTwoHourFallsBack() {
        Session s = fullSession();
        s.setMemberFemalePrice2h(null);
        s.setGuestFemalePrice2h(null);
        assertEquals(0, new BigDecimal("40000").compareTo(PricingCalculator.baseFee(s, true, Gender.FEMALE, TWO)));
        assertEquals(0, new BigDecimal("50000").compareTo(PricingCalculator.baseFee(s, false, Gender.FEMALE, TWO)));
        assertEquals(0, new BigDecimal("35000").compareTo(PricingCalculator.baseFee(s, true, Gender.MALE, TWO)));
        assertFalse(PricingCalculator.hasTwoHourPrice(s, true, Gender.FEMALE));
        assertTrue(PricingCalculator.hasTwoHourPrice(s, true, Gender.MALE));
    }

    @Test
    @DisplayName("Chỉ có giá 2h nữ mà không có 2h nam → không áp gói 2h (giống công thức cũ)")
    void femaleOnlyTwoHourIgnored() {
        Session s = noTwoHourSession();
        s.setGuestFemalePrice2h(new BigDecimal("30000"));
        assertEquals(0, new BigDecimal("50000").compareTo(PricingCalculator.baseFee(s, false, Gender.FEMALE, TWO)));
        assertFalse(PricingCalculator.hasTwoHourPrice(s, false, Gender.FEMALE));
    }

    @Test
    @DisplayName("Thời lượng khác 2.0 (3h, null) là full ca")
    void otherDurationsAreFull() {
        assertEquals(0, new BigDecimal("60000").compareTo(PricingCalculator.baseFee(fullSession(), false, Gender.MALE, new BigDecimal("3"))));
        assertTrue(PricingCalculator.isTwoHours(new BigDecimal("2")));
        assertFalse(PricingCalculator.isTwoHours(null));
    }

    @Test
    @DisplayName("Reprice: voucher % tính lại, điều chỉnh tay giữ nguyên, không âm")
    void repriceKeepsManualAdjustment() {
        Session s = fullSession();
        SessionParticipant voucher = SessionParticipant.builder()
                .adjustmentAmount(new BigDecimal("-5000")).adjustmentReason("Áp dụng Voucher 10% (Mốc 10 buổi)").build();
        PricingCalculator.reprice(voucher, s, false, Gender.MALE, null);
        assertEquals(0, new BigDecimal("-6000").compareTo(voucher.getAdjustmentAmount()));
        assertEquals(0, new BigDecimal("54000").compareTo(voucher.getFinalFee()));

        SessionParticipant manual = SessionParticipant.builder()
                .adjustmentAmount(new BigDecimal("-70000")).adjustmentReason("Host mời").build();
        PricingCalculator.reprice(manual, s, false, Gender.MALE, null);
        assertEquals(0, new BigDecimal("-70000").compareTo(manual.getAdjustmentAmount()));
        assertEquals(0, BigDecimal.ZERO.compareTo(manual.getFinalFee()));
    }

    @Test
    @DisplayName("Tiền còn lại chỉ trừ cọc khi cọc PAID; đã thanh toán = 0")
    void remainingByDepositStatus() {
        for (DepositStatus ds : DepositStatus.values()) {
            SessionParticipant p = SessionParticipant.builder()
                    .finalFee(new BigDecimal("60000")).depositAmount(new BigDecimal("20000")).depositStatus(ds).build();
            BigDecimal expected = ds == DepositStatus.PAID ? new BigDecimal("40000") : new BigDecimal("60000");
            assertEquals(0, expected.compareTo(p.getRemainingPaymentAmount()), "deposit " + ds);
        }
        SessionParticipant paid = SessionParticipant.builder()
                .finalFee(new BigDecimal("60000")).paymentStatus(PaymentStatus.PAID).build();
        assertEquals(0, BigDecimal.ZERO.compareTo(paid.getRemainingPaymentAmount()));

        SessionParticipant cheap = SessionParticipant.builder()
                .finalFee(new BigDecimal("10000")).depositAmount(new BigDecimal("20000")).depositStatus(DepositStatus.PAID).build();
        assertEquals(0, BigDecimal.ZERO.compareTo(cheap.getRemainingPaymentAmount()), "không âm");
    }

    @Test
    @DisplayName("canUndoPayment: PAID và chưa quá 7 ngày sau giờ kết thúc ca")
    void canUndoPaymentFlag() {
        LocalDateTime now = LocalDateTime.now();
        Session recent = Session.builder().endTime(now.minusDays(6)).build();
        Session old = Session.builder().endTime(now.minusDays(8)).build();

        SessionParticipant paidRecent = SessionParticipant.builder().session(recent).paymentStatus(PaymentStatus.PAID).build();
        SessionParticipant paidOld = SessionParticipant.builder().session(old).paymentStatus(PaymentStatus.PAID).build();
        SessionParticipant unpaid = SessionParticipant.builder().session(recent).paymentStatus(PaymentStatus.UNPAID).build();

        assertTrue(PricingCalculator.canUndoPayment(paidRecent, now));
        assertFalse(PricingCalculator.canUndoPayment(paidOld, now));
        assertFalse(PricingCalculator.canUndoPayment(unpaid, now));
    }

    @Test
    @DisplayName("Giá full ca trống / âm bị từ chối; giá 2h âm bị từ chối")
    void validatePrices() {
        BigDecimal v = new BigDecimal("50000");
        assertDoesNotThrow(() -> PricingCalculator.validateSessionPrices(v, v, v, v, null, null));
        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> PricingCalculator.validateSessionPrices(v, null, v, v));
        assertTrue(ex.getMessage().contains("không được để trống"));
        assertThrows(RuntimeException.class, () -> PricingCalculator.validateSessionPrices(v, v, new BigDecimal("-1"), v));
        assertThrows(RuntimeException.class, () -> PricingCalculator.validateSessionPrices(v, v, v, v, new BigDecimal("-1")));
    }
}
