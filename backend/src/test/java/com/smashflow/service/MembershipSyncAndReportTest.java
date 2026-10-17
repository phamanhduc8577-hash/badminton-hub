package com.smashflow.service;

import com.smashflow.dto.MonthlyFinancialReport;
import com.smashflow.dto.ReconciliationEntry;
import com.smashflow.model.*;
import com.smashflow.repository.MatchRepository;
import com.smashflow.repository.SessionParticipantRepository;
import com.smashflow.repository.SessionRepository;
import com.smashflow.repository.UserRepository;
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

class MembershipSyncAndReportTest {

    // ---------- 2.5 ----------

    @Test
    @DisplayName("Duyệt cố định: chỉ đổi lượt UNPAID chưa vắng ở ca chưa hủy; lượt PAID giữ nguyên")
    void approveFixedLeavesSettledRows() {
        UserRepository userRepository = mock(UserRepository.class);
        SessionParticipantRepository participantRepository = mock(SessionParticipantRepository.class);
        MemberManagementService service = new MemberManagementService(userRepository, participantRepository,
                mock(PasswordEncoder.class), mock(TelegramNotificationService.class), mock(JdbcTemplate.class),
                mock(GenderChangeService.class));

        User user = User.builder().id(7L).fullName("A").phone("0900000007").role(Role.MEMBER)
                .gender(Gender.MALE).membershipType(MembershipType.PENDING_FIXED).build();
        Session active = Session.builder().id(1L).status(SessionStatus.UPCOMING)
                .memberMalePrice(new BigDecimal("50000")).memberFemalePrice(new BigDecimal("40000"))
                .guestMalePrice(new BigDecimal("60000")).guestFemalePrice(new BigDecimal("50000")).build();
        Session cancelled = Session.builder().id(2L).status(SessionStatus.CANCELLED)
                .memberMalePrice(new BigDecimal("50000")).memberFemalePrice(new BigDecimal("40000"))
                .guestMalePrice(new BigDecimal("60000")).guestFemalePrice(new BigDecimal("50000")).build();

        SessionParticipant paid = guestRow(1, active);
        paid.setPaymentStatus(PaymentStatus.PAID);
        SessionParticipant absent = guestRow(2, active);
        absent.setCheckinStatus(CheckinStatus.ABSENT);
        SessionParticipant inCancelled = guestRow(3, cancelled);
        SessionParticipant open = guestRow(4, active);
        open.setDepositStatus(DepositStatus.PENDING);
        open.setDepositAmount(new BigDecimal("20000"));

        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(participantRepository.findByUserId(7L)).thenReturn(List.of(paid, absent, inCancelled, open));

        service.approveFixedMember(7L);

        for (SessionParticipant untouched : List.of(paid, absent, inCancelled)) {
            assertTrue(untouched.getIsGuest());
            assertEquals(0, new BigDecimal("60000").compareTo(untouched.getFinalFee()));
        }
        assertFalse(open.getIsGuest());
        assertEquals(0, new BigDecimal("50000").compareTo(open.getFinalFee()));
        assertEquals(DepositStatus.NONE, open.getDepositStatus());
        assertEquals(0, BigDecimal.ZERO.compareTo(open.getDepositAmount()));
        verify(participantRepository, times(1)).save(any());
    }

    private static SessionParticipant guestRow(long id, Session s) {
        return SessionParticipant.builder().id(id).session(s).isGuest(true).gender(Gender.MALE)
                .baseFee(new BigDecimal("60000")).finalFee(new BigDecimal("60000")).build();
    }

    // ---------- 2.10 ----------

    @Test
    @DisplayName("Tháng không có ca → báo cáo rỗng (không lấy dữ liệu tháng/năm khác)")
    void emptyMonthReport() {
        SessionRepository sessionRepository = mock(SessionRepository.class);
        SessionParticipantRepository participantRepository = mock(SessionParticipantRepository.class);
        MatchRepository matchRepository = mock(MatchRepository.class);
        ReportService service = new ReportService(sessionRepository, participantRepository, matchRepository);

        Session other = Session.builder().id(9L).title("Ca tháng khác")
                .startTime(LocalDateTime.of(2025, 3, 10, 18, 0)).endTime(LocalDateTime.of(2025, 3, 10, 20, 0)).build();
        when(sessionRepository.findAllByOrderByStartTimeDesc()).thenReturn(List.of(other));
        when(sessionRepository.findByStartTimeBetweenOrderByStartTimeDesc(any(), any())).thenReturn(List.of());

        MonthlyFinancialReport r = service.getMonthlyFinancialReport(2026, 3);

        assertEquals(0, r.getTotalSessions());
        assertEquals(0, BigDecimal.ZERO.compareTo(r.getTotalRevenue()));
        assertEquals(0, BigDecimal.ZERO.compareTo(r.getNetProfit()));
        assertTrue(r.getSessionSummaries().isEmpty());
        assertTrue(r.getTopPlayers().isEmpty());
        verify(sessionRepository).findByStartTimeBetweenOrderByStartTimeDesc(
                eq(LocalDateTime.of(2026, 3, 1, 0, 0)), argThat(end -> end.getMonthValue() == 3 && end.getDayOfMonth() == 31));
        verify(participantRepository, never()).findBySessionId(anyLong());
    }

    @Test
    @DisplayName("Top người chơi theo số trận thắng TRONG THÁNG, không theo tổng thắng toàn thời gian")
    void topPlayersByMonthWins() {
        SessionRepository sessionRepository = mock(SessionRepository.class);
        SessionParticipantRepository participantRepository = mock(SessionParticipantRepository.class);
        MatchRepository matchRepository = mock(MatchRepository.class);
        ReportService service = new ReportService(sessionRepository, participantRepository, matchRepository);

        User veteran = User.builder().id(1L).fullName("Lão làng").winCount(500).lossCount(10).build();
        User rookie = User.builder().id(2L).fullName("Tân binh").winCount(2).lossCount(0).build();
        Session s = Session.builder().id(5L).title("Ca").status(SessionStatus.UPCOMING)
                .startTime(LocalDateTime.of(2026, 3, 10, 18, 0)).endTime(LocalDateTime.of(2026, 3, 10, 20, 0))
                .costCourt(BigDecimal.ZERO).costShuttlecock(BigDecimal.ZERO).build();
        when(sessionRepository.findByStartTimeBetweenOrderByStartTimeDesc(any(), any())).thenReturn(List.of(s));
        when(sessionRepository.findById(5L)).thenReturn(Optional.of(s));
        SessionParticipant p1 = SessionParticipant.builder().id(1L).session(s).user(veteran).checkinStatus(CheckinStatus.CHECKED_IN).build();
        SessionParticipant p2 = SessionParticipant.builder().id(2L).session(s).user(rookie).checkinStatus(CheckinStatus.CHECKED_IN).build();
        when(participantRepository.findBySessionIdInWithUser(List.of(5L))).thenReturn(List.of(p1, p2));
        Match m1 = Match.builder().id(1L).session(s).teamAPlayer1(rookie).teamBPlayer1(veteran).winningTeam(WinningTeam.A).build();
        Match m2 = Match.builder().id(2L).session(s).teamAPlayer1(rookie).teamBPlayer1(veteran).winningTeam(WinningTeam.A).build();
        when(matchRepository.findBySessionIdIn(List.of(5L))).thenReturn(List.of(m1, m2));

        MonthlyFinancialReport r = service.getMonthlyFinancialReport(2026, 3);

        assertEquals("Tân binh", r.getTopPlayers().get(0).getFullName());
        assertEquals(2, r.getTopPlayers().get(0).getWinCount());
        assertEquals(0, r.getTopPlayers().get(1).getWinCount());
        assertEquals(2, r.getTopPlayers().get(1).getLossCount());
        assertEquals(1, r.getTopPlayers().get(0).getSessionsAttended());
    }

    // ---------- 2.12 ----------

    @Test
    @DisplayName("Đối soát cọc: map đủ trường từ lượt đăng ký")
    void reconciliationMapsRows() {
        SessionRepository sessionRepository = mock(SessionRepository.class);
        SessionParticipantRepository participantRepository = mock(SessionParticipantRepository.class);
        ReportService service = new ReportService(sessionRepository, participantRepository, mock(MatchRepository.class));

        Session s = Session.builder().id(5L).title("Ca cũ").startTime(LocalDateTime.of(2026, 9, 1, 18, 0)).build();
        SessionParticipant p = SessionParticipant.builder().id(11L).session(s).guestName("Khách").guestPhone("0911222333")
                .paymentStatus(PaymentStatus.PAID).paymentMethod(PaymentMethod.CASH)
                .depositAmount(new BigDecimal("20000")).depositStatus(DepositStatus.PAID)
                .finalFee(new BigDecimal("60000")).build();
        when(participantRepository.findLegacyPaidWithDeposit()).thenReturn(List.of(p));

        List<ReconciliationEntry> rows = service.getDepositReconciliation();

        assertEquals(1, rows.size());
        ReconciliationEntry e = rows.get(0);
        assertEquals(11L, e.getParticipantId());
        assertEquals(5L, e.getSessionId());
        assertEquals("Ca cũ", e.getSessionTitle());
        assertEquals("Khách", e.getName());
        assertEquals("0911222333", e.getPhone());
        assertEquals(PaymentMethod.CASH, e.getPaymentMethod());
        assertEquals(DepositStatus.PAID, e.getDepositStatus());
        assertEquals(0, new BigDecimal("20000").compareTo(e.getDepositAmount()));
    }
}
