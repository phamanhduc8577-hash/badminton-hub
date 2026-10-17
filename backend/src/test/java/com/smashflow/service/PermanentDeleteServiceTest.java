package com.smashflow.service;

import com.smashflow.dto.MemberProfileResponse;
import com.smashflow.model.*;
import com.smashflow.repository.LoyaltyRewardRepository;
import com.smashflow.repository.SessionParticipantRepository;
import com.smashflow.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PermanentDeleteServiceTest {

    private UserRepository userRepository;
    private SessionParticipantRepository participantRepository;
    private LoyaltyRewardRepository rewardRepository;
    private MemberManagementService service;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        participantRepository = mock(SessionParticipantRepository.class);
        rewardRepository = mock(LoyaltyRewardRepository.class);
        service = new MemberManagementService(userRepository, participantRepository,
                mock(PasswordEncoder.class), mock(TelegramNotificationService.class), mock(JdbcTemplate.class),
                mock(GenderChangeService.class));
        service.setLoyaltyRewardRepository(rewardRepository);
        when(participantRepository.findByUserId(anyLong())).thenReturn(List.of());
        when(rewardRepository.findByUserIdAndIsClaimedFalseOrderByMilestoneSessionsAsc(anyLong())).thenReturn(List.of());
    }

    private User softDeleted() {
        User u = User.builder().id(42L).fullName("Nguyễn Văn A").phone("0901234567").password("hash")
                .avatarUrl("data:image/png;base64,xyz").role(Role.MEMBER).deleted(true)
                .winCount(7).lossCount(3).eloScore(1200).dailyPasswordResetCount(2).tokenVersion(3).build();
        when(userRepository.findById(42L)).thenReturn(Optional.of(u));
        return u;
    }

    @Test
    @DisplayName("Ẩn danh hóa tên/SĐT/mật khẩu/avatar, đánh dấu purged, tăng token_version, giữ chỉ số")
    void anonymizesUser() {
        User u = softDeleted();

        String msg = service.permanentlyDeleteMember(42L, "  Nguyễn Văn A ");

        assertTrue(msg.contains("Nguyễn Văn A"));
        assertEquals("Thành viên đã xóa #42", u.getFullName());
        assertNotEquals("0901234567", u.getPhone());
        assertTrue(u.getPhone().length() <= 20);
        assertTrue(u.getPhone().startsWith("DEL42-"));
        assertNull(u.getPassword());
        assertEquals("/duck-mascot.png", u.getAvatarUrl());
        assertTrue(u.getDeleted());
        assertTrue(u.getPurged());
        assertEquals(4, u.currentTokenVersion());
        assertEquals(0, u.getDailyPasswordResetCount());
        assertEquals(7, u.getWinCount());
        assertEquals(3, u.getLossCount());
        assertEquals(1200, u.getEloScore());
        verify(userRepository).save(u);
    }

    @Test
    @DisplayName("SĐT giả trùng thì sinh lại; luôn ≤ 20 ký tự kể cả id dài")
    void placeholderRetriesAndFits() {
        User u = softDeleted();
        u.setId(12345678901234L);
        when(userRepository.findById(12345678901234L)).thenReturn(Optional.of(u));
        when(userRepository.existsByPhone(anyString())).thenReturn(true, false);

        service.permanentlyDeleteMember(12345678901234L, "Nguyễn Văn A");

        assertTrue(u.getPhone().length() <= 20);
        assertTrue(u.getPhone().startsWith("DEL"));
        verify(userRepository, times(2)).existsByPhone(anyString());
    }

    @Test
    @DisplayName("Chặn Host, chưa xóa mềm, đã xóa vĩnh viễn, sai tên, không tồn tại")
    void guards() {
        User host = User.builder().id(1L).fullName("Host").phone("0900000001").role(Role.HOST).deleted(true).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(host));
        assertEquals("Không thể xóa vĩnh viễn tài khoản Host!",
                assertThrows(RuntimeException.class, () -> service.permanentlyDeleteMember(1L, "Host")).getMessage());

        User active = User.builder().id(2L).fullName("B").phone("0900000002").role(Role.MEMBER).deleted(false).build();
        when(userRepository.findById(2L)).thenReturn(Optional.of(active));
        assertEquals("Vui lòng xóa tài khoản (đưa vào danh sách khôi phục) trước khi xóa vĩnh viễn!",
                assertThrows(RuntimeException.class, () -> service.permanentlyDeleteMember(2L, "B")).getMessage());

        User purged = User.builder().id(3L).fullName("Thành viên đã xóa #3").phone("DEL3-ABCDEF")
                .role(Role.MEMBER).deleted(true).purged(true).build();
        when(userRepository.findById(3L)).thenReturn(Optional.of(purged));
        assertEquals("Tài khoản này đã được xóa vĩnh viễn!",
                assertThrows(RuntimeException.class, () -> service.permanentlyDeleteMember(3L, "Thành viên đã xóa #3")).getMessage());

        softDeleted();
        assertEquals("Tên xác nhận không khớp!",
                assertThrows(RuntimeException.class, () -> service.permanentlyDeleteMember(42L, "Nguyễn Văn B")).getMessage());
        assertEquals("Tên xác nhận không khớp!",
                assertThrows(RuntimeException.class, () -> service.permanentlyDeleteMember(42L, null)).getMessage());

        when(userRepository.findById(99L)).thenReturn(Optional.empty());
        assertEquals("Không tìm thấy thành viên!",
                assertThrows(RuntimeException.class, () -> service.permanentlyDeleteMember(99L, "X")).getMessage());

        verify(userRepository, never()).save(any());
        verify(participantRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Xóa lượt chưa thu ở ca sắp tới; giữ lượt PAID / ca đã qua / cọc đã nhận và xóa thông tin khách")
    void participations() {
        User u = softDeleted();
        Session future = Session.builder().id(1L).status(SessionStatus.UPCOMING)
                .startTime(LocalDateTime.now().plusDays(2)).endTime(LocalDateTime.now().plusDays(2).plusHours(2)).build();
        Session past = Session.builder().id(2L).status(SessionStatus.COMPLETED)
                .startTime(LocalDateTime.now().minusDays(2)).endTime(LocalDateTime.now().minusDays(2).plusHours(2)).build();

        SessionParticipant futureUnpaid = row(1, future, u);
        SessionParticipant futurePaid = row(2, future, u);
        futurePaid.setPaymentStatus(PaymentStatus.PAID);
        SessionParticipant futureDepositPaid = row(3, future, u);
        futureDepositPaid.setDepositStatus(DepositStatus.PAID);
        futureDepositPaid.setDepositAmount(new BigDecimal("20000"));
        SessionParticipant pastUnpaid = row(4, past, u);
        SessionParticipant futureForfeited = row(5, future, u);
        futureForfeited.setDepositStatus(DepositStatus.FORFEITED);
        when(participantRepository.findByUserId(42L))
                .thenReturn(List.of(futureUnpaid, futurePaid, futureDepositPaid, pastUnpaid, futureForfeited));

        service.permanentlyDeleteMember(42L, "Nguyễn Văn A");

        verify(participantRepository).delete(futureUnpaid);
        verify(participantRepository, times(1)).delete(any());
        for (SessionParticipant kept : List.of(futurePaid, futureDepositPaid, pastUnpaid, futureForfeited)) {
            assertEquals("Thành viên đã xóa #42", kept.getGuestName());
            assertNull(kept.getGuestPhone());
            assertEquals(0, new BigDecimal("60000").compareTo(kept.getFinalFee()));
            verify(participantRepository).save(kept);
        }
        assertEquals(PaymentStatus.PAID, futurePaid.getPaymentStatus());
        assertEquals(DepositStatus.PAID, futureDepositPaid.getDepositStatus());
        assertEquals(0, new BigDecimal("20000").compareTo(futureDepositPaid.getDepositAmount()));
    }

    private static SessionParticipant row(long id, Session s, User u) {
        return SessionParticipant.builder().id(id).session(s).user(u).guestName("Nguyễn Văn A").guestPhone("0901234567")
                .baseFee(new BigDecimal("60000")).finalFee(new BigDecimal("60000")).build();
    }

    @Test
    @DisplayName("Chỉ xóa phần thưởng chưa nhận")
    void deletesOnlyUnclaimedRewards() {
        User u = softDeleted();
        LoyaltyReward unclaimed = LoyaltyReward.builder().id(1L).user(u).milestoneSessions(5).rewardName("Quấn cán").isClaimed(false).build();
        when(rewardRepository.findByUserIdAndIsClaimedFalseOrderByMilestoneSessionsAsc(42L)).thenReturn(List.of(unclaimed));

        service.permanentlyDeleteMember(42L, "Nguyễn Văn A");

        verify(rewardRepository).deleteAll(List.of(unclaimed));
        verify(rewardRepository, never()).delete(any());
        verify(rewardRepository, never()).deleteAllInBatch();
    }

    @Test
    @DisplayName("Danh sách đã xóa không chứa tài khoản đã xóa vĩnh viễn; danh sách thành viên cũng không")
    void listsExcludePurged() {
        User soft = User.builder().id(1L).fullName("Soft").phone("0900000001").role(Role.MEMBER).deleted(true).build();
        User purged = User.builder().id(2L).fullName("Thành viên đã xóa #2").phone("DEL2-ABCDEF")
                .role(Role.MEMBER).deleted(true).purged(true).build();
        User active = User.builder().id(3L).fullName("Active").phone("0900000003").role(Role.MEMBER).build();
        when(userRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(soft, purged, active));
        User host = User.builder().id(9L).role(Role.HOST).build();

        List<MemberProfileResponse> deleted = service.getDeletedMembers(host);
        assertEquals(List.of(1L), deleted.stream().map(MemberProfileResponse::getId).toList());

        List<MemberProfileResponse> all = service.getAllMembers(host);
        assertEquals(List.of(3L), all.stream().map(MemberProfileResponse::getId).toList());
    }

    @Test
    @DisplayName("Không khôi phục được tài khoản đã xóa vĩnh viễn")
    void restorePurgedBlocked() {
        User purged = User.builder().id(2L).fullName("Thành viên đã xóa #2").phone("DEL2-ABCDEF")
                .role(Role.MEMBER).deleted(true).purged(true).build();
        when(userRepository.findById(2L)).thenReturn(Optional.of(purged));

        RuntimeException ex = assertThrows(RuntimeException.class, () -> service.restoreMember(2L));
        assertEquals("Tài khoản đã bị xóa vĩnh viễn, không thể khôi phục!", ex.getMessage());
        assertTrue(purged.getDeleted());
        verify(userRepository, never()).save(any());
    }
}
