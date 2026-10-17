package com.smashflow.service;

import com.smashflow.dto.CreateSessionRequest;
import com.smashflow.dto.JoinSessionRequest;
import com.smashflow.dto.UpdateSessionRequest;
import com.smashflow.model.*;
import com.smashflow.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SessionMoneyRulesTest {

    @Mock private SessionRepository sessionRepository;
    @Mock private SessionParticipantRepository participantRepository;
    @Mock private VenueRepository venueRepository;
    @Mock private UserRepository userRepository;
    @Mock private VietQrService vietQrService;
    @Mock private TelegramNotificationService telegramNotificationService;
    @Mock private LoyaltyRewardRepository loyaltyRewardRepository;
    @InjectMocks private SessionService service;

    private User host;
    private User member;
    private Session session;
    private final List<SessionParticipant> roster = new ArrayList<>();

    @BeforeEach
    void setUp() {
        host = User.builder().id(1L).fullName("Host").phone("0325000001").role(Role.HOST).build();
        member = User.builder().id(7L).fullName("Thành Viên").phone("0900000007").role(Role.MEMBER)
                .gender(Gender.MALE).membershipType(MembershipType.CASUAL).build();
        Venue venue = Venue.builder().id(1L).name("Sân A").address("Q7").build();
        session = Session.builder().id(5L).title("Ca tối").venue(venue).host(host)
                .startTime(LocalDateTime.now().plusDays(1)).endTime(LocalDateTime.now().plusDays(1).plusHours(3))
                .memberMalePrice(new BigDecimal("50000")).memberFemalePrice(new BigDecimal("40000"))
                .guestMalePrice(new BigDecimal("60000")).guestFemalePrice(new BigDecimal("50000"))
                .build();
        roster.clear();
        when(sessionRepository.findById(5L)).thenReturn(Optional.of(session));
        when(sessionRepository.findByIdWithLock(5L)).thenReturn(Optional.of(session));
        when(participantRepository.findBySessionId(5L)).thenReturn(roster);
    }

    private SessionParticipant add(long id, boolean guest, String fee) {
        SessionParticipant p = SessionParticipant.builder().id(id).session(session).user(member).isGuest(guest)
                .gender(Gender.MALE).baseFee(new BigDecimal(fee)).finalFee(new BigDecimal(fee)).build();
        roster.add(p);
        when(participantRepository.findById(id)).thenReturn(Optional.of(p));
        when(participantRepository.findByIdForUpdate(id)).thenReturn(Optional.of(p));
        return p;
    }

    private UpdateSessionRequest titleOnly() {
        UpdateSessionRequest r = new UpdateSessionRequest();
        r.setTitle("Ca tối (đổi tên)");
        return r;
    }

    // ---------- 2.4 ----------

    @Test
    @DisplayName("Chỉ sửa tiêu đề (hoặc gửi lại giá y nguyên) → không tính lại giá ai")
    void titleOnlyEditDoesNotReprice() {
        SessionParticipant manual = add(1, true, "60000");
        manual.setAdjustmentAmount(new BigDecimal("-10000"));
        manual.setAdjustmentReason("Host giảm");
        manual.setFinalFee(new BigDecimal("50000"));

        service.updateSession(5L, titleOnly());

        UpdateSessionRequest samePrices = titleOnly();
        samePrices.setGuestMalePrice(new BigDecimal("60000.00"));
        samePrices.setMemberMalePrice(new BigDecimal("50000"));
        service.updateSession(5L, samePrices);

        assertEquals(0, new BigDecimal("50000").compareTo(manual.getFinalFee()));
        verify(participantRepository, never()).findBySessionId(5L);
        verify(participantRepository, never()).save(any());
    }

    @Test
    @DisplayName("Đổi giá: bỏ qua lượt PAID / ABSENT / FORFEITED; giữ điều chỉnh tay; tính lại voucher %")
    void priceEditSkipsSettledRows() {
        SessionParticipant paid = add(1, true, "60000");
        paid.setPaymentStatus(PaymentStatus.PAID);
        SessionParticipant absent = add(2, true, "60000");
        absent.setCheckinStatus(CheckinStatus.ABSENT);
        SessionParticipant forfeited = add(3, true, "20000");
        forfeited.setDepositStatus(DepositStatus.FORFEITED);
        SessionParticipant manual = add(4, true, "60000");
        manual.setAdjustmentAmount(new BigDecimal("-10000"));
        manual.setAdjustmentReason("Host giảm bạn bè");
        manual.setFinalFee(new BigDecimal("50000"));
        SessionParticipant voucher = add(5, true, "60000");
        voucher.setAdjustmentAmount(new BigDecimal("-6000"));
        voucher.setAdjustmentReason("Áp dụng Voucher 10% (Mốc 10 buổi)");
        voucher.setFinalFee(new BigDecimal("54000"));
        SessionParticipant fixed = add(6, false, "50000");

        UpdateSessionRequest r = titleOnly();
        r.setGuestMalePrice(new BigDecimal("70000"));
        r.setMemberMalePrice(new BigDecimal("55000"));
        service.updateSession(5L, r);

        assertEquals(0, new BigDecimal("60000").compareTo(paid.getFinalFee()));
        assertEquals(0, new BigDecimal("60000").compareTo(absent.getFinalFee()));
        assertEquals(0, new BigDecimal("20000").compareTo(forfeited.getFinalFee()));
        assertEquals(0, new BigDecimal("-10000").compareTo(manual.getAdjustmentAmount()));
        assertEquals(0, new BigDecimal("60000").compareTo(manual.getFinalFee()));
        assertEquals(0, new BigDecimal("-7000").compareTo(voucher.getAdjustmentAmount()));
        assertEquals(0, new BigDecimal("63000").compareTo(voucher.getFinalFee()));
        assertEquals(0, new BigDecimal("55000").compareTo(fixed.getFinalFee()));
        verify(participantRepository, times(3)).save(any());
    }

    @Test
    @DisplayName("Sửa ca với giá full ca âm → 400")
    void updateNegativePriceRejected() {
        UpdateSessionRequest r = titleOnly();
        r.setGuestFemalePrice(new BigDecimal("-5"));
        assertThrows(RuntimeException.class, () -> service.updateSession(5L, r));
    }

    @Test
    @DisplayName("Tạo ca với giá full ca trống → 400")
    void createWithMissingPriceRejected() {
        CreateSessionRequest r = new CreateSessionRequest();
        r.setTitle("Ca mới");
        r.setStartTime(LocalDateTime.now().plusDays(1));
        r.setEndTime(LocalDateTime.now().plusDays(1).plusHours(2));
        r.setGuestMalePrice(null);
        RuntimeException ex = assertThrows(RuntimeException.class, () -> service.createSession(host, r));
        assertTrue(ex.getMessage().contains("Giá full ca"));
        verify(sessionRepository, never()).save(any());
    }

    // ---------- 2.9 ----------

    @Test
    @DisplayName("Xóa lượt đã thanh toán bị chặn")
    void deletePaidBlocked() {
        SessionParticipant paid = add(1, true, "60000");
        paid.setPaymentStatus(PaymentStatus.PAID);
        assertEquals("Lượt đã thanh toán, vui lòng hoàn tác thu tiền trước khi xóa!",
                assertThrows(RuntimeException.class, () -> service.removeParticipant(1L, false)).getMessage());
        verify(participantRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Hủy slot hoàn đúng voucher theo voucher_reward_id (không dò theo %)")
    void voucherRefundById() {
        SessionParticipant p = add(1, true, "60000");
        p.setVoucherRewardId(42L);
        p.setAdjustmentAmount(new BigDecimal("-6000"));
        p.setAdjustmentReason("Áp dụng Voucher 10% (Mốc 10 buổi)");

        LoyaltyReward target = LoyaltyReward.builder().id(42L).user(member).milestoneSessions(20).isClaimed(true)
                .claimedAt(LocalDateTime.now()).rewardName("V").build();
        when(loyaltyRewardRepository.findById(42L)).thenReturn(Optional.of(target));

        service.removeParticipant(1L, false);

        assertFalse(target.getIsClaimed());
        assertNull(target.getClaimedAt());
        verify(loyaltyRewardRepository).save(same(target));
        verify(loyaltyRewardRepository, never()).findByUserIdOrderByMilestoneSessionsAsc(anyLong());
        verify(participantRepository).delete(p);
    }

    @Test
    @DisplayName("Đăng ký tự áp voucher → lưu voucher_reward_id")
    void joinStoresVoucherRewardId() {
        LoyaltyReward voucher = LoyaltyReward.builder().id(42L).user(member).milestoneSessions(10).isClaimed(false).rewardName("V").build();
        when(loyaltyRewardRepository.findByUserIdAndIsClaimedFalseOrderByMilestoneSessionsAsc(7L)).thenReturn(List.of(voucher));
        when(participantRepository.findBySessionIdAndUserId(5L, 7L)).thenReturn(Optional.empty());
        when(participantRepository.countPastBookingsByPhone(any())).thenReturn(3L);
        when(participantRepository.save(any())).thenAnswer(i -> {
            SessionParticipant sp = i.getArgument(0);
            sp.setId(99L);
            return sp;
        });
        session.setMaxSlots(10);

        service.memberJoinSession(5L, member, new JoinSessionRequest());

        // Mốc 10 buổi = voucher 15% trên 60k
        verify(participantRepository).save(argThat(sp -> sp instanceof SessionParticipant p
                && Long.valueOf(42L).equals(p.getVoucherRewardId())
                && p.getAdjustmentAmount().compareTo(new BigDecimal("-9000")) == 0));
        assertTrue(voucher.getIsClaimed());
    }

    // ---------- 2.11 ----------

    @Test
    @DisplayName("Xác nhận cọc chỉ từ PENDING; FORFEITED / REFUNDED / PAID bị chặn")
    void confirmDepositOnlyFromPending() {
        SessionParticipant p = add(1, true, "60000");
        p.setDepositAmount(new BigDecimal("20000"));
        for (DepositStatus ds : List.of(DepositStatus.FORFEITED, DepositStatus.REFUNDED, DepositStatus.PAID, DepositStatus.NONE)) {
            p.setDepositStatus(ds);
            assertThrows(RuntimeException.class, () -> service.confirmDeposit(1L), ds.name());
            assertEquals(ds, p.getDepositStatus());
        }
        p.setDepositStatus(DepositStatus.PENDING);
        // Đã thu đủ tiền (cọc chưa trừ) → không cho xác nhận cọc nữa, tránh thống kê "đã thu cọc" bị cộng thừa
        p.setPaymentStatus(PaymentStatus.PAID);
        assertThrows(RuntimeException.class, () -> service.confirmDeposit(1L));
        assertEquals(DepositStatus.PENDING, p.getDepositStatus());
        p.setPaymentStatus(PaymentStatus.UNPAID);

        service.confirmDeposit(1L);
        assertEquals(DepositStatus.PAID, p.getDepositStatus());
    }

    // ---------- 2.2 ----------

    @Test
    @DisplayName("QR thanh toán dùng tiền còn lại chuẩn: cọc PENDING không trừ, cọc PAID có trừ")
    void finalQrUsesAuthoritativeRemaining() {
        SessionParticipant p = add(1, true, "60000");
        p.setDepositAmount(new BigDecimal("20000"));
        p.setDepositStatus(DepositStatus.PENDING);
        service.getFinalPaymentQrUrl(1L, host);
        verify(vietQrService).generateQrUrl(argThat(a -> a.compareTo(new BigDecimal("60000")) == 0), eq("SF1"));

        p.setDepositStatus(DepositStatus.PAID);
        service.getFinalPaymentQrUrl(1L, host);
        verify(vietQrService).generateQrUrl(argThat(a -> a.compareTo(new BigDecimal("40000")) == 0), eq("SF1"));
    }
}
