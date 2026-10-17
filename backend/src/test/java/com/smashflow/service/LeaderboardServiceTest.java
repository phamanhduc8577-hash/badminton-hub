package com.smashflow.service;

import com.smashflow.dto.LeaderboardPageResponse;
import com.smashflow.model.Role;
import com.smashflow.model.User;
import com.smashflow.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LeaderboardServiceTest {

    @Test
    @DisplayName("Leaderboard dùng truy vấn SQL đã lọc (không findAll lọc trong bộ nhớ), phân trang + vị trí của tôi")
    void usesFilteredSqlQueries() {
        UserRepository repo = mock(UserRepository.class);
        LeaderboardService service = new LeaderboardService(repo);
        User a = User.builder().id(1L).fullName("A").phone("0900000001").role(Role.MEMBER).eloScore(900).build();
        User b = User.builder().id(2L).fullName("B").phone("0900000002").role(Role.HOST).eloScore(500).build();
        User c = User.builder().id(3L).fullName("C").phone("0900000003").role(Role.MEMBER).eloScore(100).build();
        when(repo.findEloLeaderboard()).thenReturn(List.of(a, b, c));
        when(repo.findAttendanceLeaderboard()).thenReturn(List.of(c, a));

        LeaderboardPageResponse elo = service.getWinRateLeaderboard(0, 2, c);
        assertEquals(List.of(1L, 2L), elo.getEntries().stream().map(e -> e.getId()).toList());
        assertEquals(3, elo.getTotal());
        assertTrue(elo.isHasMore());
        assertEquals(3, elo.getMe().getRank());

        LeaderboardPageResponse att = service.getAttendanceLeaderboard(0, 30, null);
        assertEquals(List.of(3L, 1L), att.getEntries().stream().map(e -> e.getId()).toList());
        assertNull(att.getMe());

        verify(repo, never()).findAll();
    }
}
