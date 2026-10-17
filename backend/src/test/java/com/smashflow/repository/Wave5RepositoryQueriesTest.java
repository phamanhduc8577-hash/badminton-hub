package com.smashflow.repository;

import com.smashflow.model.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Chạy thật các truy vấn JPQL mới của đợt 5 trên H2 (chỉ dùng cho test). */
@DataJpaTest(properties = {
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class Wave5RepositoryQueriesTest {

    @Autowired private TestEntityManager em;
    @Autowired private SessionRepository sessionRepository;
    @Autowired private SessionParticipantRepository participantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private MatchRepository matchRepository;
    @Autowired private VenueRepository venueRepository;

    private User host;
    private User member;
    private User guest;
    private User deleted;
    private Venue venue;
    private Session past;
    private Session ongoing;
    private Session future;
    private Session cancelled;

    private User user(String phone, String name, Role role, int sessions, int elo, int wins, boolean isDeleted) {
        return em.persist(User.builder().phone(phone).fullName(name).role(role).sessionsAttended(sessions)
                .eloScore(elo).winCount(wins).lossCount(0).deleted(isDeleted).build());
    }

    private Session session(String title, LocalDateTime start, LocalDateTime end, SessionStatus status) {
        return em.persist(Session.builder().venue(venue).host(host).title(title).startTime(start).endTime(end).status(status).build());
    }

    private SessionParticipant part(Session s, User u, String guestPhone, CheckinStatus st) {
        return em.persist(SessionParticipant.builder().session(s).user(u).guestPhone(guestPhone).checkinStatus(st).build());
    }

    @BeforeEach
    void setUp() {
        host = user("0325000001", "Host", Role.HOST, 5, 900, 20, false);
        member = user("0900000007", "Thành viên", Role.MEMBER, 9, 1200, 5, false);
        guest = user("0911000111", "Khách", Role.GUEST, 30, 3000, 50, false);
        deleted = user("0900000099", "Đã xóa", Role.MEMBER, 40, 2500, 40, true);
        venue = em.persist(Venue.builder().name("Sân A").address("Q7")
                .latitude(new BigDecimal("10.1")).longitude(new BigDecimal("106.1")).build());
        LocalDateTime now = LocalDateTime.now();
        past = session("Đã qua", now.minusHours(5), now.minusHours(3), SessionStatus.UPCOMING);
        ongoing = session("Đang diễn ra", now.minusHours(1), now.plusHours(1), SessionStatus.UPCOMING);
        future = session("Sắp tới", now.plusDays(1), now.plusDays(1).plusHours(2), SessionStatus.UPCOMING);
        cancelled = session("Đã hủy", now.plusHours(3), now.plusHours(5), SessionStatus.CANCELLED);
        em.flush();
    }

    @Test
    @DisplayName("Ca sắp tới: bỏ ca đã kết thúc và ca đã hủy, ca sớm nhất trước")
    void upcomingFilter() {
        List<Session> upcoming = sessionRepository.findUpcomingWithDetails(LocalDateTime.now());
        assertEquals(List.of(ongoing.getId(), future.getId()), upcoming.stream().map(Session::getId).toList());
        assertEquals("Sân A", upcoming.get(0).getVenue().getName());
        assertEquals(4, sessionRepository.findAllWithDetailsOrderByStartTimeDesc().size());
    }

    @Test
    @DisplayName("Bảng xếp hạng: bỏ tài khoản đã xóa và GUEST, giữ Host; sắp xếp bằng SQL")
    void leaderboardExcludesDeletedAndGuest() {
        assertEquals(List.of(member.getId(), host.getId()),
                userRepository.findAttendanceLeaderboard().stream().map(User::getId).toList());
        assertEquals(List.of(member.getId(), host.getId()),
                userRepository.findEloLeaderboard().stream().map(User::getId).toList());
    }

    @Test
    @DisplayName("Đếm slot gộp theo ca: booked không tính ABSENT, checkedIn chỉ CHECKED_IN")
    void batchSlotCounts() {
        part(future, member, null, CheckinStatus.PENDING);
        part(future, host, null, CheckinStatus.CHECKED_IN);
        part(future, guest, "0911000111", CheckinStatus.ABSENT);
        part(ongoing, member, null, CheckinStatus.CHECKED_IN);
        em.flush();

        Map<Long, long[]> counts = new HashMap<>();
        for (Object[] row : participantRepository.countSlotsBySessionIds(List.of(future.getId(), ongoing.getId(), past.getId()))) {
            counts.put(((Number) row[0]).longValue(), new long[]{((Number) row[1]).longValue(), ((Number) row[2]).longValue()});
        }
        assertArrayEquals(new long[]{2, 1}, counts.get(future.getId()));
        assertArrayEquals(new long[]{1, 1}, counts.get(ongoing.getId()));
        assertNull(counts.get(past.getId()));
    }

    @Test
    @DisplayName("Tìm lượt trùng theo user HOẶC SĐT (kể cả khi userId null)")
    void findByUserOrPhone() {
        SessionParticipant byUser = part(future, member, null, CheckinStatus.PENDING);
        SessionParticipant byGuestPhone = part(future, null, "0988777666", CheckinStatus.ABSENT);
        part(ongoing, member, null, CheckinStatus.PENDING);
        em.flush();

        assertEquals(List.of(byUser.getId()), ids(participantRepository.findBySessionAndUserOrPhone(future.getId(), member.getId(), "0123")));
        // SĐT của tài khoản (u.phone) cũng khớp dù userId không gửi
        assertEquals(List.of(byUser.getId()), ids(participantRepository.findBySessionAndUserOrPhone(future.getId(), null, "0900000007")));
        assertEquals(List.of(byGuestPhone.getId()), ids(participantRepository.findBySessionAndUserOrPhone(future.getId(), null, "0988777666")));
        assertTrue(participantRepository.findBySessionAndUserOrPhone(past.getId(), member.getId(), "0900000007").isEmpty());
    }

    @Test
    @DisplayName("Dữ liệu cũ trùng (ca, user): findBySessionIdAndUserId không ném lỗi, ưu tiên dòng không vắng")
    void duplicateSafeLookup() {
        part(future, member, null, CheckinStatus.ABSENT);
        SessionParticipant active = part(future, member, null, CheckinStatus.PENDING);
        em.flush();
        assertEquals(active.getId(), participantRepository.findBySessionIdAndUserId(future.getId(), member.getId()).orElseThrow().getId());
        assertTrue(participantRepository.findBySessionIdAndUserId(past.getId(), member.getId()).isEmpty());
    }

    @Test
    @DisplayName("Venue: đếm ca khác dùng chung; tìm venue theo tên + địa chỉ không phân biệt hoa thường")
    void venueQueries() {
        assertEquals(3, sessionRepository.countByVenueIdAndIdNot(venue.getId(), future.getId()));
        assertEquals(venue.getId(), venueRepository.findFirstByNameIgnoreCaseAndAddressIgnoreCaseOrderByIdAsc("sân a", "q7").orElseThrow().getId());
        assertTrue(venueRepository.findFirstByNameIgnoreCaseAndAddressIgnoreCaseOrderByIdAsc("Sân A", "Q1").isEmpty());
    }

    @Test
    @DisplayName("Báo cáo tháng: nạp gộp lượt/trận theo danh sách ca; đếm số trận của user")
    void reportBatchQueries() {
        part(future, member, null, CheckinStatus.CHECKED_IN);
        part(ongoing, host, null, CheckinStatus.CHECKED_IN);
        em.persist(Match.builder().session(future).teamAPlayer1(member).teamBPlayer1(host).winningTeam(WinningTeam.A)
                .a1LpDelta(20).b1LpDelta(-18).build());
        em.persist(Match.builder().session(past).teamAPlayer1(host).teamBPlayer1(member).winningTeam(WinningTeam.B).build());
        em.flush();
        em.clear();

        assertEquals(2, participantRepository.findBySessionIdInWithUser(List.of(future.getId(), ongoing.getId())).size());
        List<Match> ms = matchRepository.findBySessionIdIn(List.of(future.getId()));
        assertEquals(1, ms.size());
        assertEquals(20, ms.get(0).getA1LpDelta());
        assertEquals(2, matchRepository.countAllByUserId(member.getId()));
    }

    private static List<Long> ids(List<SessionParticipant> rows) {
        return rows.stream().map(SessionParticipant::getId).toList();
    }
}
