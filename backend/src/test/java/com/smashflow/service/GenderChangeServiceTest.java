package com.smashflow.service;

import com.smashflow.model.*;
import com.smashflow.repository.SessionParticipantRepository;
import com.smashflow.repository.UserRepository;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GenderChangeServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private SessionParticipantRepository participantRepository;
    @Mock private TelegramNotificationService telegramNotificationService;
    @InjectMocks private GenderChangeService service;

    private User user;
    private Session session;
    private final List<SessionParticipant> participations = new ArrayList<>();

    @BeforeEach
    void setUp() {
        user = User.builder().id(7L).phone("0900000007").fullName("Lỡ Tay")
                .gender(Gender.FEMALE).sessionsAttended(0).winCount(0).lossCount(0).build();
        session = Session.builder().id(1L).title("Ca tối").status(SessionStatus.UPCOMING)
                .memberMalePrice(new BigDecimal("50000")).memberFemalePrice(new BigDecimal("40000"))
                .guestMalePrice(new BigDecimal("60000")).guestFemalePrice(new BigDecimal("50000"))
                .guestMalePrice2h(new BigDecimal("45000")).guestFemalePrice2h(new BigDecimal("35000"))
                .build();
        participations.clear();
        when(participantRepository.findByUserId(7L)).thenReturn(participations);
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    private SessionParticipant pending(boolean guest, BigDecimal fee) {
        SessionParticipant p = SessionParticipant.builder().id((long) participations.size() + 1)
                .session(session).user(user).isGuest(guest).gender(Gender.FEMALE)
                .baseFee(fee).finalFee(fee).build();
        participations.add(p);
        return p;
    }

    @Test
    @DisplayName("Tài khoản mới (0 buổi, chưa đăng ký ca) được tự sửa")
    void newAccountNotLocked() {
        assertFalse(service.isSelfEditLocked(user));
    }

    @Test
    @DisplayName("Chỉ đăng ký ca (chưa điểm danh, chưa trả tiền/cọc) vẫn được tự sửa")
    void pendingRegistrationNotLocked() {
        pending(true, new BigDecimal("50000"));
        assertFalse(service.isSelfEditLocked(user));
    }

    @Test
    @DisplayName("Khóa tự sửa khi đã đi buổi / có trận / điểm danh / thanh toán / đã cọc")
    void lockedCases() {
        user.setSessionsAttended(1);
        assertTrue(service.isSelfEditLocked(user));
        user.setSessionsAttended(0);

        user.setLossCount(1);
        assertTrue(service.isSelfEditLocked(user));
        user.setLossCount(0);

        SessionParticipant p = pending(true, new BigDecimal("50000"));
        p.setCheckinStatus(CheckinStatus.CHECKED_IN);
        assertTrue(service.isSelfEditLocked(user));

        p.setCheckinStatus(CheckinStatus.LATE);
        assertTrue(service.isSelfEditLocked(user));

        p.setCheckinStatus(CheckinStatus.PENDING);
        p.setPaymentStatus(PaymentStatus.PAID);
        assertTrue(service.isSelfEditLocked(user));

        p.setPaymentStatus(PaymentStatus.UNPAID);
        p.setDepositStatus(DepositStatus.PAID);
        assertTrue(service.isSelfEditLocked(user));
    }

    @Test
    @DisplayName("Tự đổi Nữ → Nam: lưu user và tính lại giá ca chưa thanh toán (vãng lai full ca)")
    void selfChangeRepricesUnpaid() {
        SessionParticipant p = pending(true, new BigDecimal("50000"));

        int repriced = service.changeBySelf(user, Gender.MALE);

        assertEquals(1, repriced);
        assertEquals(Gender.MALE, user.getGender());
        assertEquals(Gender.MALE, p.getGender());
        assertEquals(0, new BigDecimal("60000").compareTo(p.getBaseFee()));
        assertEquals(0, new BigDecimal("60000").compareTo(p.getFinalFee()));
        verify(userRepository).save(user);
        verify(participantRepository).save(p);
    }

    @Test
    @DisplayName("Bị khóa thì ném lỗi và KHÔNG đổi gì")
    void selfChangeBlockedWhenLocked() {
        user.setSessionsAttended(2);
        RuntimeException ex = assertThrows(RuntimeException.class, () -> service.changeBySelf(user, Gender.MALE));
        assertTrue(ex.getMessage().contains("liên hệ Host"));
        assertEquals(Gender.FEMALE, user.getGender());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Chọn lại đúng giới tính hiện tại = không làm gì (kể cả khi bị khóa)")
    void sameGenderNoop() {
        user.setSessionsAttended(5);
        assertEquals(0, service.changeBySelf(user, Gender.FEMALE));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Không chấp nhận OTHER / null")
    void rejectInvalidGender() {
        assertThrows(RuntimeException.class, () -> service.changeBySelf(user, Gender.OTHER));
        assertThrows(RuntimeException.class, () -> service.changeByHost(7L, null));
    }

    @Test
    @DisplayName("Host sửa được dù đã có lịch sử; lượt đã thanh toán / ca hủy / vắng giữ nguyên giá")
    void hostChangeKeepsSettledHistory() {
        user.setSessionsAttended(10);
        user.setWinCount(4);

        SessionParticipant paid = pending(true, new BigDecimal("50000"));
        paid.setPaymentStatus(PaymentStatus.PAID);
        paid.setCheckinStatus(CheckinStatus.CHECKED_IN);

        SessionParticipant absent = pending(true, new BigDecimal("50000"));
        absent.setCheckinStatus(CheckinStatus.ABSENT);

        Session cancelled = Session.builder().id(2L).status(SessionStatus.CANCELLED).build();
        SessionParticipant inCancelled = pending(true, new BigDecimal("50000"));
        inCancelled.setSession(cancelled);

        SessionParticipant unpaidCheckedIn = pending(true, new BigDecimal("50000"));
        unpaidCheckedIn.setCheckinStatus(CheckinStatus.CHECKED_IN);

        User result = service.changeByHost(7L, Gender.MALE);

        assertEquals(Gender.MALE, result.getGender());
        assertEquals(0, new BigDecimal("50000").compareTo(paid.getFinalFee()));
        assertEquals(Gender.FEMALE, paid.getGender());
        assertEquals(0, new BigDecimal("50000").compareTo(absent.getFinalFee()));
        assertEquals(0, new BigDecimal("50000").compareTo(inCancelled.getFinalFee()));
        assertEquals(0, new BigDecimal("60000").compareTo(unpaidCheckedIn.getFinalFee()));
        verify(participantRepository, times(1)).save(any());
    }

    @Test
    @DisplayName("Giá thành viên cố định + gói 2h + voucher % được tính lại đúng, điều chỉnh tay giữ nguyên")
    void repricingMemberTier2hAndAdjustments() {
        session.setMemberMalePrice2h(new BigDecimal("35000"));
        session.setMemberFemalePrice2h(new BigDecimal("30000"));

        SessionParticipant member = pending(false, new BigDecimal("40000"));

        SessionParticipant twoHours = pending(true, new BigDecimal("35000"));
        twoHours.setDurationHours(new BigDecimal("2.0"));

        SessionParticipant voucher = pending(true, new BigDecimal("50000"));
        voucher.setAdjustmentAmount(new BigDecimal("-5000"));
        voucher.setAdjustmentReason("Áp dụng Voucher 10% (Mốc 10 buổi)");

        SessionParticipant manual = pending(true, new BigDecimal("50000"));
        manual.setAdjustmentAmount(new BigDecimal("-10000"));
        manual.setAdjustmentReason("Host giảm giá bạn bè");
        manual.setFinalFee(new BigDecimal("40000"));

        service.changeByHost(7L, Gender.MALE);

        assertEquals(0, new BigDecimal("50000").compareTo(member.getFinalFee()), "Cố định nam full ca");
        assertEquals(0, new BigDecimal("45000").compareTo(twoHours.getFinalFee()), "Vãng lai nam gói 2h");
        assertEquals(0, new BigDecimal("-6000").compareTo(voucher.getAdjustmentAmount()), "Voucher 10% của 60k");
        assertEquals(0, new BigDecimal("54000").compareTo(voucher.getFinalFee()));
        assertEquals(0, new BigDecimal("-10000").compareTo(manual.getAdjustmentAmount()), "Giảm tay giữ nguyên");
        assertEquals(0, new BigDecimal("50000").compareTo(manual.getFinalFee()));
    }

    @Test
    @DisplayName("Nam → Nữ khi ca chưa cấu hình giá nữ 2h thì dùng giá nữ full ca (giống lúc đăng ký)")
    void femaleFallbackWhen2hFemaleMissing() {
        user.setGender(Gender.MALE);
        session.setGuestFemalePrice2h(null);
        SessionParticipant twoHours = pending(true, new BigDecimal("45000"));
        twoHours.setGender(Gender.MALE);
        twoHours.setDurationHours(new BigDecimal("2.0"));

        service.changeBySelf(user, Gender.FEMALE);

        assertEquals(0, new BigDecimal("50000").compareTo(twoHours.getFinalFee()));
    }
}
