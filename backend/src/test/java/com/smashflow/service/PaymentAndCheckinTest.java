package com.smashflow.service;

import com.smashflow.dto.CheckinRequest;
import com.smashflow.dto.HostOverrideRequest;
import com.smashflow.dto.ParticipantResponse;
import com.smashflow.dto.SettlePaymentRequest;
import com.smashflow.model.*;
import com.smashflow.repository.SessionParticipantRepository;
import com.smashflow.repository.SessionRepository;
import com.smashflow.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PaymentAndCheckinTest {

    @Mock private SessionRepository sessionRepository;
    @Mock private SessionParticipantRepository participantRepository;
    @Mock private UserRepository userRepository;
    @Mock private LoyaltyRewardService loyaltyRewardService;
    @Mock private GeoLocationService geoLocationService;
    @Mock private TelegramNotificationService telegramNotificationService;
    @InjectMocks private CheckinAndPricingService service;

    private User host;
    private User member;
    private Session session;
    private SessionParticipant participant;

    @BeforeEach
    void setUp() {
        host = User.builder().id(1L).fullName("Host").phone("0325000001").role(Role.HOST).build();
        member = User.builder().id(7L).fullName("Thành Viên").phone("0900000007").role(Role.MEMBER)
                .gender(Gender.MALE).sessionsAttended(3).build();
        Venue venue = Venue.builder().id(1L).name("Sân A").build();
        LocalDateTime now = LocalDateTime.now();
        session = Session.builder().id(5L).title("Ca <tối>").venue(venue).host(host)
                .startTime(now.minusMinutes(10)).endTime(now.plusHours(2))
                .checkinToken("ABCD1234")
                .memberMalePrice(new BigDecimal("50000")).memberFemalePrice(new BigDecimal("40000"))
                .guestMalePrice(new BigDecimal("60000")).guestFemalePrice(new BigDecimal("50000"))
                .build();
        participant = SessionParticipant.builder().id(101L).session(session).user(member).isGuest(true)
                .gender(Gender.MALE)
                .depositStatus(DepositStatus.PENDING).depositAmount(new BigDecimal("20000"))
                .baseFee(new BigDecimal("60000")).finalFee(new BigDecimal("60000")).build();

        when(sessionRepository.findById(5L)).thenReturn(Optional.of(session));
        when(participantRepository.findById(101L)).thenReturn(Optional.of(participant));
        when(participantRepository.findByIdForUpdate(101L)).thenReturn(Optional.of(participant));
        when(participantRepository.findBySessionIdAndUserId(5L, 7L)).thenReturn(Optional.of(participant));
    }

    private SettlePaymentRequest settle(PaymentMethod m) {
        SettlePaymentRequest r = new SettlePaymentRequest();
        r.setParticipantId(101L);
        r.setPaymentMethod(m);
        return r;
    }

    // ---------- 2.2 / 2.3 Thu tiền ----------

    @Nested
    class Settle {
        @Test
        @DisplayName("Cọc chưa nhận (PENDING): thu đủ 60k, không tự đánh dấu cọc PAID; lưu paidAt/paidBy")
        void settleDoesNotFlipDeposit() {
            service.settlePayment(settle(PaymentMethod.CASH), host);
            assertEquals(PaymentStatus.PAID, participant.getPaymentStatus());
            assertEquals(DepositStatus.PENDING, participant.getDepositStatus());
            assertNotNull(participant.getPaidAt());
            assertEquals(1L, participant.getPaidBy());
            verify(telegramNotificationService).notifyPaymentSettled(any(), any(), any(), eq("60000"), any());
        }

        @Test
        @DisplayName("Cọc đã nhận (PAID): số tiền thu = 40k")
        void settleWithPaidDepositCollectsRemaining() {
            participant.setDepositStatus(DepositStatus.PAID);
            service.settlePayment(settle(PaymentMethod.VIETQR), host);
            verify(telegramNotificationService).notifyPaymentSettled(any(), any(), any(), eq("40000"), any());
        }

        @Test
        @DisplayName("Thu lần 2 bị chặn, không gửi Telegram lần 2")
        void settleTwiceBlocked() {
            service.settlePayment(settle(PaymentMethod.CASH), host);
            RuntimeException ex = assertThrows(RuntimeException.class, () -> service.settlePayment(settle(PaymentMethod.CASH), host));
            assertEquals("Lượt này đã thanh toán rồi!", ex.getMessage());
            verify(telegramNotificationService, times(1)).notifyPaymentSettled(any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("Response có paidAt + canUndoPayment=true sau khi thu")
        void responseHasUndoFlag() {
            ParticipantResponse res = service.settlePayment(settle(PaymentMethod.CASH), host);
            assertNotNull(res.getPaidAt());
            assertTrue(res.getCanUndoPayment());
            assertEquals(0, BigDecimal.ZERO.compareTo(res.getRemainingAmount()));
        }
    }

    // ---------- 2.3 Hoàn tác thu tiền ----------

    @Nested
    class Undo {
        @BeforeEach
        void paid() {
            participant.setPaymentStatus(PaymentStatus.PAID);
            participant.setPaymentMethod(PaymentMethod.CASH);
            participant.setPaidAt(LocalDateTime.now());
            participant.setPaidBy(1L);
        }

        @Test
        @DisplayName("Trong 7 ngày: về UNPAID, xóa method/paidAt/paidBy, báo Telegram kèm lý do")
        void undoWithinWindow() {
            session.setEndTime(LocalDateTime.now().minusDays(6));
            ParticipantResponse res = service.undoPayment(101L, "Bấm nhầm", host);
            assertEquals(PaymentStatus.UNPAID, participant.getPaymentStatus());
            assertNull(participant.getPaymentMethod());
            assertNull(participant.getPaidAt());
            assertNull(participant.getPaidBy());
            assertFalse(res.getCanUndoPayment());
            assertEquals(0, new BigDecimal("60000").compareTo(res.getRemainingAmount()));
            verify(telegramNotificationService).notifyPaymentUndone(eq("Ca <tối>"), eq("Thành Viên"), any(), eq("60000"), eq("Bấm nhầm"), eq("Host"));
        }

        @Test
        @DisplayName("Quá 7 ngày sau khi ca kết thúc: bị chặn")
        void undoAfterWindowBlocked() {
            session.setEndTime(LocalDateTime.now().minusDays(7).minusMinutes(1));
            RuntimeException ex = assertThrows(RuntimeException.class, () -> service.undoPayment(101L, "Bấm nhầm", host));
            assertEquals("Chỉ hoàn tác được trong 7 ngày sau khi ca kết thúc!", ex.getMessage());
            assertEquals(PaymentStatus.PAID, participant.getPaymentStatus());
        }

        @Test
        @DisplayName("Lý do trống bị chặn")
        void blankReason() {
            assertEquals("Vui lòng nhập lý do hoàn tác!",
                    assertThrows(RuntimeException.class, () -> service.undoPayment(101L, "   ", host)).getMessage());
            assertEquals("Vui lòng nhập lý do hoàn tác!",
                    assertThrows(RuntimeException.class, () -> service.undoPayment(101L, null, host)).getMessage());
            assertEquals(PaymentStatus.PAID, participant.getPaymentStatus());
        }

        @Test
        @DisplayName("Lượt chưa thanh toán: bị chặn")
        void notPaid() {
            participant.setPaymentStatus(PaymentStatus.UNPAID);
            assertEquals("Lượt này chưa thanh toán!",
                    assertThrows(RuntimeException.class, () -> service.undoPayment(101L, "x", host)).getMessage());
            verify(telegramNotificationService, never()).notifyPaymentUndone(any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("Hoàn tác xong thì thu lại được")
        void settleAgainAfterUndo() {
            service.undoPayment(101L, "Bấm nhầm", host);
            assertDoesNotThrow(() -> service.settlePayment(settle(PaymentMethod.VIETQR), host));
            assertEquals(PaymentMethod.VIETQR, participant.getPaymentMethod());
        }
    }

    // ---------- 2.11 Sửa hóa đơn ----------

    @Test
    @DisplayName("Sửa hóa đơn lượt đã thanh toán bị chặn")
    void overridePaidBlocked() {
        participant.setPaymentStatus(PaymentStatus.PAID);
        HostOverrideRequest r = new HostOverrideRequest();
        r.setParticipantId(101L);
        r.setOverrideFinalFee(new BigDecimal("10000"));
        assertEquals("Lượt đã thanh toán, vui lòng hoàn tác thu tiền trước khi sửa!",
                assertThrows(RuntimeException.class, () -> service.hostOverrideBill(r)).getMessage());
        assertEquals(0, new BigDecimal("60000").compareTo(participant.getFinalFee()));
    }

    @Test
    @DisplayName("Sửa hóa đơn ra số âm bị chặn (số tuyệt đối hoặc điều chỉnh)")
    void overrideNegativeBlocked() {
        HostOverrideRequest abs = new HostOverrideRequest();
        abs.setParticipantId(101L);
        abs.setOverrideFinalFee(new BigDecimal("-1"));
        assertThrows(RuntimeException.class, () -> service.hostOverrideBill(abs));

        HostOverrideRequest adj = new HostOverrideRequest();
        adj.setParticipantId(101L);
        adj.setAdjustmentAmount(new BigDecimal("-70000"));
        assertThrows(RuntimeException.class, () -> service.hostOverrideBill(adj));
        assertEquals(0, new BigDecimal("60000").compareTo(participant.getFinalFee()));
        verify(participantRepository, never()).save(any());
    }

    @Test
    @DisplayName("Sửa hóa đơn hợp lệ: điều chỉnh +20k")
    void overrideValid() {
        HostOverrideRequest adj = new HostOverrideRequest();
        adj.setParticipantId(101L);
        adj.setAdjustmentAmount(new BigDecimal("20000"));
        adj.setAdjustmentReason("Nước");
        ParticipantResponse res = service.hostOverrideBill(adj);
        assertEquals(0, new BigDecimal("80000").compareTo(res.getFinalFee()));
    }

    // ---------- 2.6 / 2.7 / 2.8 Tự điểm danh ----------

    @Nested
    class SelfCheckin {
        private User managed;

        @BeforeEach
        void ready() {
            participant.setDepositStatus(DepositStatus.PAID);
            managed = User.builder().id(7L).fullName("Thành Viên").phone("0900000007").role(Role.MEMBER)
                    .gender(Gender.MALE).sessionsAttended(3).build();
            when(userRepository.findById(7L)).thenReturn(Optional.of(managed));
            when(participantRepository.countDistinctCheckedInSessions(7L)).thenReturn(4L);
        }

        private CheckinRequest req(BigDecimal duration) {
            CheckinRequest r = new CheckinRequest();
            r.setToken("abcd1234");
            r.setDurationHours(duration);
            return r;
        }

        @Test
        @DisplayName("Bấm đúp: lần 2 thấy CHECKED_IN bị chặn → số buổi chỉ tính 1 lần; không lưu principal")
        void doubleCheckinCountsOnce() {
            service.memberCheckin(5L, member, req(null));
            assertEquals(CheckinStatus.CHECKED_IN, participant.getCheckinStatus());

            RuntimeException ex = assertThrows(RuntimeException.class, () -> service.memberCheckin(5L, member, req(null)));
            assertEquals("Bạn đã điểm danh ca này rồi!", ex.getMessage());

            verify(participantRepository, times(2)).findByIdForUpdate(101L);
            verify(userRepository, times(1)).save(any());
            verify(userRepository, never()).save(same(member));
            verify(userRepository).save(same(managed));
            assertEquals(4, managed.getSessionsAttended());
            assertEquals(3, member.getSessionsAttended(), "principal không bị sửa");
            verify(loyaltyRewardService, times(1)).grantEligibleRewards(same(managed), eq(4));
        }

        @Test
        @DisplayName("Trước giờ bắt đầu hơn 30 phút: chưa mở điểm danh")
        void tooEarly() {
            session.setStartTime(LocalDateTime.now().plusMinutes(31));
            session.setEndTime(LocalDateTime.now().plusHours(3));
            assertEquals("Chưa tới giờ điểm danh (mở trước giờ bắt đầu 30 phút)!",
                    assertThrows(RuntimeException.class, () -> service.memberCheckin(5L, member, req(null))).getMessage());
        }

        @Test
        @DisplayName("Trong vòng 30 phút trước giờ bắt đầu: được điểm danh (kể cả tokenExpiresAt đã qua)")
        void withinThirtyMinutes() {
            session.setStartTime(LocalDateTime.now().plusMinutes(29));
            session.setEndTime(LocalDateTime.now().plusHours(3));
            session.setTokenExpiresAt(LocalDateTime.now().minusHours(1));
            assertDoesNotThrow(() -> service.memberCheckin(5L, member, req(null)));
        }

        @Test
        @DisplayName("Sau giờ kết thúc ca: phải gặp Host")
        void afterEnd() {
            session.setStartTime(LocalDateTime.now().minusHours(3));
            session.setEndTime(LocalDateTime.now().minusMinutes(1));
            assertEquals("Ca đã kết thúc, vui lòng gặp Host để điểm danh!",
                    assertThrows(RuntimeException.class, () -> service.memberCheckin(5L, member, req(null))).getMessage());
        }

        @Test
        @DisplayName("Lượt bị đánh vắng (ABSENT): bị chặn")
        void absentRejected() {
            participant.setCheckinStatus(CheckinStatus.ABSENT);
            assertEquals("Lượt đăng ký này đã bị đánh vắng, vui lòng gặp Host!",
                    assertThrows(RuntimeException.class, () -> service.memberCheckin(5L, member, req(null))).getMessage());
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Chọn 2 tiếng lúc điểm danh: ca có giá 2h + chưa thanh toán → áp giá 2h")
        void twoHourRepriced() {
            session.setGuestMalePrice2h(new BigDecimal("45000"));
            session.setGuestFemalePrice2h(new BigDecimal("35000"));
            ParticipantResponse res = service.memberCheckin(5L, member, req(new BigDecimal("2.0")));
            assertEquals(0, new BigDecimal("45000").compareTo(participant.getBaseFee()));
            assertEquals(0, new BigDecimal("45000").compareTo(participant.getFinalFee()));
            assertEquals(0, new BigDecimal("2.0").compareTo(participant.getDurationHours()));
            assertEquals(0, new BigDecimal("25000").compareTo(res.getRemainingAmount()), "trừ cọc 20k đã nhận");
        }

        @Test
        @DisplayName("Chọn 2 tiếng nhưng ca không có giá 2h → giữ giá full ca")
        void twoHourIgnoredWithoutPrice() {
            service.memberCheckin(5L, member, req(new BigDecimal("2.0")));
            assertEquals(0, new BigDecimal("60000").compareTo(participant.getFinalFee()));
            assertNull(participant.getDurationHours());
        }

        @Test
        @DisplayName("Chọn 2 tiếng khi lượt đã thanh toán → không đổi giá")
        void twoHourIgnoredWhenPaid() {
            session.setGuestMalePrice2h(new BigDecimal("45000"));
            participant.setPaymentStatus(PaymentStatus.PAID);
            service.memberCheckin(5L, member, req(new BigDecimal("2.0")));
            assertEquals(0, new BigDecimal("60000").compareTo(participant.getFinalFee()));
        }

        @Test
        @DisplayName("Sai mã QR: bị chặn")
        void wrongToken() {
            CheckinRequest r = req(null);
            r.setToken("WRONG000");
            assertThrows(RuntimeException.class, () -> service.memberCheckin(5L, member, r));
            ArgumentCaptor<SessionParticipant> c = ArgumentCaptor.forClass(SessionParticipant.class);
            verify(participantRepository, never()).saveAndFlush(c.capture());
        }
    }
}
