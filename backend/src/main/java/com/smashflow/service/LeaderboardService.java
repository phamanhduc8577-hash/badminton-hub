package com.smashflow.service;

import com.smashflow.dto.LeaderboardEntry;
import com.smashflow.dto.LeaderboardPageResponse;
import com.smashflow.model.User;
import com.smashflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LeaderboardService {

    public static final int DEFAULT_PAGE_SIZE = 30;
    public static final int MAX_PAGE_SIZE = 50;

    private final UserRepository userRepository;

    public LeaderboardPageResponse getAttendanceLeaderboard(int page, int size, User currentUser) {
        List<User> ranked = userRepository.findAll().stream()
                .filter(u -> !Boolean.TRUE.equals(u.getDeleted()))
                .sorted(Comparator.<User>comparingInt(u -> nz(u.getSessionsAttended())).reversed()
                        .thenComparing(User::getId))
                .toList();
        return buildPage(ranked, page, size, currentUser);
    }

    public LeaderboardPageResponse getWinRateLeaderboard(int page, int size, User currentUser) {
        // Elo ranking: điểm Elo giảm dần, hòa thì ai nhiều trận thắng hơn đứng trên
        List<User> ranked = userRepository.findAll().stream()
                .filter(u -> !Boolean.TRUE.equals(u.getDeleted()))
                .sorted(Comparator.<User>comparingInt(u -> nz(u.getEloScore())).reversed()
                        .thenComparing(Comparator.<User>comparingInt(u -> nz(u.getWinCount())).reversed())
                        .thenComparing(User::getId))
                .toList();
        return buildPage(ranked, page, size, currentUser);
    }

    private LeaderboardPageResponse buildPage(List<User> ranked, int page, int size, User currentUser) {
        int safeSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);

        int from = (int) Math.min((long) safePage * safeSize, ranked.size());
        int to = Math.min(from + safeSize, ranked.size());

        List<LeaderboardEntry> entries = new ArrayList<>(to - from);
        for (int i = from; i < to; i++) {
            entries.add(toEntry(ranked.get(i), i + 1));
        }

        LeaderboardEntry me = null;
        if (currentUser != null && currentUser.getId() != null) {
            for (int i = 0; i < ranked.size(); i++) {
                if (currentUser.getId().equals(ranked.get(i).getId())) {
                    me = toEntry(ranked.get(i), i + 1);
                    break;
                }
            }
        }

        return LeaderboardPageResponse.builder()
                .entries(entries)
                .me(me)
                .page(safePage)
                .size(safeSize)
                .total(ranked.size())
                .hasMore(to < ranked.size())
                .build();
    }

    private LeaderboardEntry toEntry(User u, int rank) {
        return LeaderboardEntry.builder()
                .id(u.getId())
                .fullName(u.getFullName())
                .phone(maskPhone(u.getPhone()))
                .gender(u.getGender())
                .avatarUrl(u.getAvatarUrl())
                .sessionsAttended(nz(u.getSessionsAttended()))
                .winCount(nz(u.getWinCount()))
                .lossCount(nz(u.getLossCount()))
                .winRate(u.getWinRate())
                .eloScore(u.getEloScore())
                .placementMatches(u.getPlacementMatches() != null ? u.getPlacementMatches() : 0)
                .currentStreak(u.getCurrentStreak() != null ? u.getCurrentStreak() : 0)
                .shieldMatches(u.getShieldMatches() != null ? u.getShieldMatches() : 0)
                .rank(rank)
                .build();
    }

    private static int nz(Integer value) {
        return value != null ? value : 0;
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) return phone;
        return phone.substring(0, 3) + "***" + phone.substring(phone.length() - 3);
    }
}
