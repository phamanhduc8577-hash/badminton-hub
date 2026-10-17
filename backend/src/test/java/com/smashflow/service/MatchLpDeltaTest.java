package com.smashflow.service;

import com.smashflow.dto.CreateMatchRequest;
import com.smashflow.dto.UpdateMatchRequest;
import com.smashflow.model.*;
import com.smashflow.repository.MatchRepository;
import com.smashflow.repository.SessionRepository;
import com.smashflow.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 5.1: sửa / xóa trận chỉ đảo ngược đúng phần LP của trận đó. */
class MatchLpDeltaTest {

    /** Môi trường độc lập: "DB" trận + user trong bộ nhớ, repository là mock trả về từ đó. */
    static class Env {
        final MatchRepository matchRepository = mock(MatchRepository.class);
        final UserRepository userRepository = mock(UserRepository.class);
        final SessionRepository sessionRepository = mock(SessionRepository.class);
        final MatchService service = new MatchService(matchRepository, sessionRepository, userRepository);
        final Map<Long, User> users = new HashMap<>();
        final List<Match> db = new ArrayList<>();
        final AtomicLong ids = new AtomicLong(100);
        final Session session = Session.builder().id(5L).title("Ca").build();
        long matchCountOverride = -1;

        Env(int lpA, int lpB, int placement) {
            user(1L, lpA, placement);
            user(2L, lpA, placement);
            user(3L, lpB, placement);
            user(4L, lpB, placement);
            user(5L, 777, 5); // người ngoài cuộc
            when(sessionRepository.findById(5L)).thenReturn(Optional.of(session));
            when(userRepository.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(users.get((Long) i.getArgument(0))));
            when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
            when(matchRepository.save(any())).thenAnswer(i -> {
                Match m = i.getArgument(0);
                if (m.getId() == null) {
                    m.setId(ids.incrementAndGet());
                    m.setCreatedAt(LocalDateTime.of(2026, 10, 1, 18, 0).plusMinutes(m.getId()));
                }
                if (!db.contains(m)) db.add(m);
                return m;
            });
            when(matchRepository.findById(anyLong())).thenAnswer(i -> db.stream()
                    .filter(m -> m.getId().equals(i.getArgument(0))).findFirst());
            doAnswer(i -> db.remove((Match) i.getArgument(0))).when(matchRepository).delete(any());
            when(matchRepository.findAllByUserId(anyLong())).thenAnswer(i -> history(i.getArgument(0)));
            when(matchRepository.countAllByUserId(anyLong())).thenAnswer(i ->
                    matchCountOverride >= 0 ? matchCountOverride : (long) history(i.getArgument(0)).size() + 10);
        }

        void user(long id, int lp, int placement) {
            users.put(id, User.builder().id(id).fullName("U" + id).phone("09000000" + id).eloScore(lp)
                    .placementMatches(placement).currentStreak(0).shieldMatches(0).winCount(10).lossCount(10).build());
        }

        List<Match> history(Long userId) {
            List<Match> out = new ArrayList<>();
            for (Match m : db) {
                for (User p : new User[]{m.getTeamAPlayer1(), m.getTeamAPlayer2(), m.getTeamBPlayer1(), m.getTeamBPlayer2()}) {
                    if (p != null && p.getId().equals(userId)) {
                        out.add(m);
                        break;
                    }
                }
            }
            return out;
        }

        Match record(WinningTeam w) {
            CreateMatchRequest r = new CreateMatchRequest();
            r.setSessionId(5L);
            r.setTeamAPlayer1Id(1L);
            r.setTeamAPlayer2Id(2L);
            r.setTeamBPlayer1Id(3L);
            r.setTeamBPlayer2Id(4L);
            r.setWinningTeam(w);
            r.setCourtName("Sân 1");
            Long id = service.recordMatchResult(r).getId();
            return db.stream().filter(m -> m.getId().equals(id)).findFirst().orElseThrow();
        }

        void update(Long matchId, WinningTeam w) {
            UpdateMatchRequest r = new UpdateMatchRequest();
            r.setTeamAPlayer1Id(1L);
            r.setTeamAPlayer2Id(2L);
            r.setTeamBPlayer1Id(3L);
            r.setTeamBPlayer2Id(4L);
            r.setWinningTeam(w);
            service.updateMatch(matchId, r);
        }

        String state(long id) {
            User u = users.get(id);
            return "lp=" + u.getEloScore() + " w=" + u.getWinCount() + " l=" + u.getLossCount()
                    + " pl=" + u.getPlacementMatches() + " st=" + u.getCurrentStreak() + " sh=" + u.getShieldMatches();
        }
    }

    @Test
    @DisplayName("Đổi đội thắng của trận có delta: 4 người = như thể ghi đúng kết quả ngay từ đầu (kể cả khiên thăng hạng)")
    void editWinnerReversesExactDeltas() {
        Env edited = new Env(590, 500, 5);
        Match m = edited.record(WinningTeam.A);
        assertEquals(3, edited.users.get(1L).getShieldMatches(), "A thăng Bạc → 3 khiên");
        edited.update(m.getId(), WinningTeam.B);

        Env direct = new Env(590, 500, 5);
        Match d = direct.record(WinningTeam.B);

        for (long id = 1; id <= 4; id++) {
            assertEquals(direct.state(id), edited.state(id), "user " + id);
        }
        assertEquals(d.getA1LpDelta(), m.getA1LpDelta());
        assertEquals(d.getB2LpDelta(), m.getB2LpDelta());
        assertEquals(edited.users.get(1L).getEloScore(), 590 + m.getA1LpDelta());
        assertEquals(edited.users.get(3L).getEloScore(), 500 + m.getB1LpDelta());
        assertEquals("lp=777 w=10 l=10 pl=5 st=0 sh=0", edited.state(5));
        verify(edited.userRepository, never()).save(same(edited.users.get(5L)));
    }

    @Test
    @DisplayName("Xóa trận có delta: LP / thắng-thua / chuỗi / khiên trở về như trước trận")
    void deleteRestoresPreviousLp() {
        Env env = new Env(590, 500, 5);
        Map<Long, String> before = new HashMap<>();
        for (long id = 1; id <= 4; id++) before.put(id, env.state(id));

        Match m = env.record(WinningTeam.A);
        assertNotNull(m.getA1LpDelta());
        assertNotNull(m.getB2LpDelta());
        env.service.deleteMatch(m.getId());

        for (long id = 1; id <= 4; id++) {
            assertEquals(before.get(id), env.state(id), "user " + id);
        }
        assertTrue(env.db.isEmpty());
    }

    @Test
    @DisplayName("Xóa trận phân hạng: placementMatches giảm lại, LP về như cũ")
    void deletePlacementMatch() {
        Env env = new Env(0, 0, 0);
        env.matchCountOverride = 1;
        Match m = env.record(WinningTeam.A);
        assertEquals(1, env.users.get(1L).getPlacementMatches());
        assertTrue(env.users.get(1L).getEloScore() > 0);

        env.service.deleteMatch(m.getId());

        for (long id = 1; id <= 4; id++) {
            assertEquals("lp=0 w=10 l=10 pl=0 st=0 sh=0", env.state(id), "user " + id);
        }
    }

    @Test
    @DisplayName("Sửa 1 trận không đụng tới trận khác / người khác")
    void otherMatchesUntouched() {
        Env env = new Env(500, 500, 5);
        Match earlier = Match.builder().id(1L).session(env.session)
                .teamAPlayer1(env.users.get(1L)).teamBPlayer1(env.users.get(5L)).winningTeam(WinningTeam.A)
                .a1LpDelta(20).b1LpDelta(-18).createdAt(LocalDateTime.of(2026, 9, 1, 18, 0)).build();
        env.db.add(earlier);

        Match m = env.record(WinningTeam.A);
        int u3Before = env.users.get(3L).getEloScore();
        env.update(m.getId(), WinningTeam.B);

        assertEquals(20, earlier.getA1LpDelta());
        assertEquals(-18, earlier.getB1LpDelta());
        assertEquals(WinningTeam.A, earlier.getWinningTeam());
        assertEquals("lp=777 w=10 l=10 pl=5 st=0 sh=0", env.state(5));
        assertNotEquals(u3Before, env.users.get(3L).getEloScore());
        // u1: thắng trận trước, giờ thua trận này → chuỗi -1
        assertEquals(-1, env.users.get(1L).getCurrentStreak());
    }

    @Test
    @DisplayName("Trận cũ chưa có delta: tính lại theo ảnh chụp LP → kết quả xác định, ghi lại delta cho người được tính lại")
    void legacyPathDeterministic() {
        for (int run = 0; run < 2; run++) {
            Env env = new Env(100, 100, 5);
            User a = env.users.get(1L);
            User b = env.users.get(3L);
            Match m1 = Match.builder().id(1L).session(env.session).teamAPlayer1(a).teamBPlayer1(b)
                    .winningTeam(WinningTeam.A).createdAt(LocalDateTime.of(2026, 9, 1, 18, 0)).build();
            Match m2 = Match.builder().id(2L).session(env.session).teamAPlayer1(a).teamBPlayer1(b)
                    .winningTeam(WinningTeam.A).createdAt(LocalDateTime.of(2026, 9, 1, 18, 30)).build();
            env.db.add(m2);
            env.db.add(m1);

            env.service.deleteMatch(2L);

            // A: tính lại từ 0, trận phân hạng thắng đối thủ ảnh chụp 100 LP → +50; B: thua phân hạng → 0 LP
            assertEquals(50, a.getEloScore(), "run " + run);
            assertEquals(1, a.getWinCount());
            assertEquals(0, a.getLossCount());
            assertEquals(1, a.getPlacementMatches());
            assertEquals(0, b.getEloScore());
            assertEquals(1, b.getLossCount());
            assertEquals(50, m1.getA1LpDelta());
            assertEquals(0, m1.getB1LpDelta());
            assertEquals(List.of(m1), env.db);
        }
    }
}
