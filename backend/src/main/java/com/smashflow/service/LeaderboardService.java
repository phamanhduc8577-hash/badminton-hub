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
        // Đồng bộ số buổi tham gia thực tế: nếu có win/loss > 0 thì tối thiểu là 1 buổi
        List<User> users = userRepository.findAll().stream()
                .filter(u -> !Boolean.TRUE.equals(u.getDeleted()))
                .peek(u -> {
                    int attended = u.getSessionsAttended() != null ? u.getSessionsAttended() : 0;
                    if (attended == 0 && ((u.getWinCount() != null && u.getWinCount() > 0) || (u.getLossCount() != null && u.getLossCount() > 0))) {
                        u.setSessionsAttended(1);
                        userRepository.save(u);
                    }
                })
                .sorted((a, b) -> Integer.compare(
                        b.getSessionsAttended() != null ? b.getSessionsAttended() : 0,
                        a.getSessionsAttended() != null ? a.getSessionsAttended() : 0
                ))
                .toList();

        List<LeaderboardEntry> result = new ArrayList<>();
        int rank = 1;

        for (User u : users) {
            int attended = u.getSessionsAttended() != null ? u.getSessionsAttended() : 0;
            if (attended == 0 && ((u.getWinCount() != null && u.getWinCount() > 0) || (u.getLossCount() != null && u.getLossCount() > 0))) {
                attended = 1;
            }
            result.add(LeaderboardEntry.builder()
                    .id(u.getId())
                    .fullName(u.getFullName())
                    .phone(maskPhone(u.getPhone()))
                    .gender(u.getGender())
                    .avatarUrl(u.getAvatarUrl())
                    .sessionsAttended(attended)
                    .winCount(u.getWinCount() != null ? u.getWinCount() : 0)
                    .lossCount(u.getLossCount() != null ? u.getLossCount() : 0)
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
                .filter(u -> !Boolean.TRUE.equals(u.getDeleted()))
                .sorted((a, b) -> {
                    int eloCompare = Integer.compare(b.getEloScore(), a.getEloScore());
                    if (eloCompare != 0) return eloCompare;
                    return Integer.compare(b.getWinCount(), a.getWinCount());
                })
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
