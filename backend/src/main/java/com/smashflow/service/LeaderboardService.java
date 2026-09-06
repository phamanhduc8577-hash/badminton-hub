package com.smashflow.service;

import com.smashflow.dto.LeaderboardEntry;
import com.smashflow.model.User;
import com.smashflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LeaderboardService {

    private final UserRepository userRepository;

    public List<LeaderboardEntry> getAttendanceLeaderboard() {
        List<User> users = userRepository.findAll().stream()
                .sorted((a, b) -> Integer.compare(b.getSessionsAttended(), a.getSessionsAttended()))
                .limit(20)
                .toList();

        List<LeaderboardEntry> result = new ArrayList<>();
        int rank = 1;

        for (User u : users) {
            result.add(LeaderboardEntry.builder()
                    .id(u.getId())
                    .fullName(u.getFullName())
                    .phone(maskPhone(u.getPhone()))
                    .gender(u.getGender())
                    .avatarUrl(u.getAvatarUrl())
                    .sessionsAttended(u.getSessionsAttended())
                    .winCount(u.getWinCount())
                    .lossCount(u.getLossCount())
                    .winRate(u.getWinRate())
                    .eloScore(u.getEloScore())
                    .placementMatches(u.getPlacementMatches() != null ? u.getPlacementMatches() : 0)
                    .currentStreak(u.getCurrentStreak() != null ? u.getCurrentStreak() : 0)
                    .shieldMatches(u.getShieldMatches() != null ? u.getShieldMatches() : 0)
                    .rank(rank++)
                    .build());
        }
        return result;
    }

    public List<LeaderboardEntry> getWinRateLeaderboard() {
        // Elo ranking based on (winCount - lossCount) >= 0
        List<User> users = userRepository.findAll().stream()
                .sorted((a, b) -> {
                    int eloCompare = Integer.compare(b.getEloScore(), a.getEloScore());
                    if (eloCompare != 0) return eloCompare;
                    return Integer.compare(b.getWinCount(), a.getWinCount());
                })
                .limit(20)
                .toList();

        List<LeaderboardEntry> result = new ArrayList<>();
        int rank = 1;

        for (User u : users) {
            result.add(LeaderboardEntry.builder()
                    .id(u.getId())
                    .fullName(u.getFullName())
                    .phone(maskPhone(u.getPhone()))
                    .gender(u.getGender())
                    .avatarUrl(u.getAvatarUrl())
                    .sessionsAttended(u.getSessionsAttended())
                    .winCount(u.getWinCount())
                    .lossCount(u.getLossCount())
                    .winRate(u.getWinRate())
                    .eloScore(u.getEloScore())
                    .placementMatches(u.getPlacementMatches() != null ? u.getPlacementMatches() : 0)
                    .currentStreak(u.getCurrentStreak() != null ? u.getCurrentStreak() : 0)
                    .shieldMatches(u.getShieldMatches() != null ? u.getShieldMatches() : 0)
                    .rank(rank++)
                    .build());
        }
        return result;
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) return phone;
        return phone.substring(0, 3) + "***" + phone.substring(phone.length() - 3);
    }
}
