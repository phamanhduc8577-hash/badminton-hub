package com.smashflow.service;

import com.smashflow.dto.CreateMatchRequest;
import com.smashflow.dto.MatchResponse;
import com.smashflow.model.Match;
import com.smashflow.model.Session;
import com.smashflow.model.User;
import com.smashflow.model.WinningTeam;
import com.smashflow.repository.MatchRepository;
import com.smashflow.repository.SessionRepository;
import com.smashflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MatchService {

    private final MatchRepository matchRepository;
    private final SessionRepository sessionRepository;
    private final UserRepository userRepository;

    public List<MatchResponse> getMatchesBySession(Long sessionId) {
        return matchRepository.findBySessionIdOrderByCreatedAtDesc(sessionId).stream()
                .map(this::toMatchResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public MatchResponse recordMatchResult(CreateMatchRequest request) {
        Session session = sessionRepository.findById(request.getSessionId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca đánh!"));

        // 0. Time Validation: Cannot record matches for sessions in the future
        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(session.getStartTime())) {
            throw new RuntimeException("Ca đánh này chưa bắt đầu (Thời gian bắt đầu: "
                    + session.getStartTime().toString().replace("T", " ")
                    + "). Không thể ghi nhận kết quả trước giờ thực tế!");
        }

        Long pA1Id = request.getTeamAPlayer1Id();
        Long pA2Id = request.getTeamAPlayer2Id();
        Long pB1Id = request.getTeamBPlayer1Id();
        Long pB2Id = request.getTeamBPlayer2Id();

        // 1. Validation: All selected players in a match must be distinct
        java.util.Set<Long> playerIds = new java.util.HashSet<>();
        playerIds.add(pA1Id);
        if (pA2Id != null && !playerIds.add(pA2Id)) {
            throw new RuntimeException("Một người chơi không thể cùng lúc ở 2 vị trí trong một trận đấu!");
        }
        if (!playerIds.add(pB1Id)) {
            throw new RuntimeException("Một người chơi không thể đối đầu với chính mình hoặc trùng lặp vị trí!");
        }
        if (pB2Id != null && !playerIds.add(pB2Id)) {
            throw new RuntimeException("Một người chơi không thể cùng lúc ở 2 vị trí trong một trận đấu!");
        }

        User pA1 = userRepository.findById(pA1Id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy Player 1 Team A!"));

        User pA2 = pA2Id != null
                ? userRepository.findById(pA2Id).orElse(null)
                : null;

        User pB1 = userRepository.findById(pB1Id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy Player 1 Team B!"));

        User pB2 = pB2Id != null
                ? userRepository.findById(pB2Id).orElse(null)
                : null;

        // 2. Competitive Fair-Play Matchmaking Validation (Rank Gap Check)
        validateRankDifference(pA1, pA2, pB1, pB2);

        Match match = Match.builder()
                .session(session)
                .teamAPlayer1(pA1)
                .teamAPlayer2(pA2)
                .teamBPlayer1(pB1)
                .teamBPlayer2(pB2)
                .winningTeam(request.getWinningTeam())
                .courtName(request.getCourtName())
                .build();

        matchRepository.save(match);

        // Calculate Team LP Averages for dynamic underdog/favorite LP gain calculation
        int teamALp = calculateTeamAvgLp(pA1, pA2);
        int teamBLp = calculateTeamAvgLp(pB1, pB2);

        // Update Win/Loss/Elo Stats for all players with LOL dynamic LP & placement calibration
        if (request.getWinningTeam() == WinningTeam.A) {
            applyMatchOutcome(pA1, true, teamALp, teamBLp);
            if (pA2 != null) applyMatchOutcome(pA2, true, teamALp, teamBLp);
            applyMatchOutcome(pB1, false, teamBLp, teamALp);
            if (pB2 != null) applyMatchOutcome(pB2, false, teamBLp, teamALp);
        } else {
            applyMatchOutcome(pA1, false, teamALp, teamBLp);
            if (pA2 != null) applyMatchOutcome(pA2, false, teamALp, teamBLp);
            applyMatchOutcome(pB1, true, teamBLp, teamALp);
            if (pB2 != null) applyMatchOutcome(pB2, true, teamBLp, teamALp);
        }

        return toMatchResponse(match);
    }

    private int calculateTeamAvgLp(User p1, User p2) {
        int lp1 = p1.getEloScore();
        if (p2 == null) return lp1;
        return (lp1 + p2.getEloScore()) / 2;
    }

    /**
     * League of Legends (LMHT) Dynamic Elo & LP Progression System:
     * - Base Win: +20 LP, Base Loss: -18 LP
     * - Disparity bonus/penalty based on opponent team LP difference (Underdog vs Favorite)
     * - Win streak bonus (+2 LP for 2-streak, +5 LP for 3-streak, up to +10 LP for 5+ streak)
     * - Placement match logic (First 5 matches):
     *   - Win gives +35 to +50 LP + opponent bonus
     *   - Loss in placements has NO LP penalty (0 LP loss) to encourage newcomers
     * - Demotion Shield Protection (Bảo vệ tụt hạng):
     *   - Thăng Bậc Lớn (Bạc -> Vàng, Vàng -> Bạch Kim...): Tặng 3 trận giáp bảo vệ (shieldMatches = 3)
     *   - Thăng Đoàn Nhỏ (Vàng III -> Vàng II -> Vàng I): Tặng 1 trận giáp bảo vệ (shieldMatches = 1)
     *   - Khi ở 0 LP của Bậc/Đoàn mới mà bị thua:
     *     + Nếu còn khiên (shieldMatches > 0): Không tụt hạng, giữ nguyên ở 0 LP, tiêu hao 1 điểm khiên.
     *     + Nếu hết khiên (shieldMatches == 0): Rớt hạng, đặt về 75 LP của Đoàn/Bậc dưới.
     * - Floor protection: Iron 0 LP (cannot drop below 0 LP)
     */
    private void applyMatchOutcome(User user, boolean isWin, int myTeamLp, int oppTeamLp) {
        int placementCount = user.getPlacementMatches() != null ? user.getPlacementMatches() : 0;
        boolean inPlacements = placementCount < 5;
        int currentLp = user.getEloScore();
        int streak = user.getCurrentStreak() != null ? user.getCurrentStreak() : 0;
        int currentShield = user.getShieldMatches() != null ? user.getShieldMatches() : 0;

        int oldTier = getTierLevel(currentLp);
        int oldDivisionThreshold = getDivisionFloor(currentLp);

        int lpDiff = oppTeamLp - myTeamLp; // Positive if opponent has higher LP (underdog)

        if (isWin) {
            user.setWinCount(user.getWinCount() + 1);
            int newStreak = streak > 0 ? streak + 1 : 1;
            user.setCurrentStreak(newStreak);

            int gainedLp;
            if (inPlacements) {
                // High calibration during placements: +35 to +50 LP
                int basePlacement = 40;
                int diffAdjustment = Math.max(-10, Math.min(20, lpDiff / 10)); // +bonus if beat higher rank
                gainedLp = Math.max(25, basePlacement + diffAdjustment);
            } else {
                // Regular match: Base 20 LP
                int baseLp = 20;
                // Underdog gets up to +15 LP bonus; Favorite gets reduced LP (down to 12)
                int diffAdjustment = Math.max(-8, Math.min(15, lpDiff / 15));
                // Win streak bonus
                int streakBonus = 0;
                if (newStreak >= 5) streakBonus = 10;
                else if (newStreak >= 3) streakBonus = 5;
                else if (newStreak >= 2) streakBonus = 2;

                gainedLp = Math.max(12, Math.min(45, baseLp + diffAdjustment + streakBonus));
            }

            int newLp = currentLp + gainedLp;
            int newTier = getTierLevel(newLp);
            int newDivisionThreshold = getDivisionFloor(newLp);

            // Check promotion shield trigger
            if (!inPlacements) {
                if (newTier > oldTier) {
                    // Promoted to higher Major Tier -> Grant 3 Shield Matches
                    user.setShieldMatches(3);
                } else if (newDivisionThreshold > oldDivisionThreshold) {
                    // Promoted to higher Division (e.g. III -> II) -> Grant 1 Shield Match if no higher shield active
                    user.setShieldMatches(Math.max(currentShield, 1));
                }
            }

            user.setEloScore(newLp);
        } else {
            user.setLossCount(user.getLossCount() + 1);
            int newStreak = streak < 0 ? streak - 1 : -1;
            user.setCurrentStreak(newStreak);

            if (inPlacements) {
                // Riot rule: No LP loss in placement matches!
            } else {
                // Regular match loss: Base -18 LP
                int baseLoss = 18;
                int diffAdjustment = Math.max(-8, Math.min(8, (-lpDiff) / 15));
                int lostLp = Math.max(10, Math.min(28, baseLoss + diffAdjustment));

                int targetLp = currentLp - lostLp;
                int currentFloor = getDivisionFloor(currentLp);

                // If dropping below the current tier/division floor (would demote)
                if (targetLp < currentFloor && currentLp >= currentFloor) {
                    if (currentShield > 0) {
                        // Protected by Demotion Shield! Hold at current division floor (0 LP in division)
                        user.setEloScore(currentFloor);
                        user.setShieldMatches(currentShield - 1);
                    } else {
                        // Shield broken / exhausted -> Demote to 75 LP of previous division
                        int demotedLp = Math.max(0, currentFloor - 25);
                        user.setEloScore(demotedLp);
                        user.setShieldMatches(0);
                    }
                } else {
                    user.setEloScore(Math.max(0, targetLp));
                }
            }
        }

        if (inPlacements) {
            user.setPlacementMatches(placementCount + 1);
        }

        userRepository.save(user);
    }

    /**
     * Helper to get division boundary threshold (0, 100, 200, 300, 400, ... 2100, 2500, 3000)
     */
    private int getDivisionFloor(int lp) {
        if (lp >= 3000) return 3000;
        if (lp >= 2500) return 2500;
        if (lp >= 2100) return 2100;
        return (lp / 100) * 100;
    }

    private void validateRankDifference(User pA1, User pA2, User pB1, User pB2) {
        int tierA1 = getTierLevel(pA1.getEloScore());
        int tierA2 = pA2 != null ? getTierLevel(pA2.getEloScore()) : tierA1;
        int tierB1 = getTierLevel(pB1.getEloScore());
        int tierB2 = pB2 != null ? getTierLevel(pB2.getEloScore()) : tierB1;

        int avgTierA = (tierA1 + tierA2 + 1) / 2;
        int avgTierB = (tierB1 + tierB2 + 1) / 2;

        // Max tier gap allowed between opposing teams is 4 tiers (e.g. Sắt vs Bạch Kim max)
        int tierGap = Math.abs(avgTierA - avgTierB);
        if (tierGap > 4) {
            throw new RuntimeException("Kèo đấu bị chênh lệch trình độ quá lớn (" + tierGap + " Bậc Rank)! Vui lòng cân bằng lại đội hình.");
        }
    }

    /**
     * Map Cumulative LP to LOL Tier Levels (100 LP per Division):
     * 0: IRON (Sắt III..I: 0 - 299 LP)
     * 1: BRONZE (Đồng III..I: 300 - 599 LP)
     * 2: SILVER (Bạc III..I: 600 - 899 LP)
     * 3: GOLD (Vàng III..I: 900 - 1199 LP)
     * 4: PLATINUM (Bạch Kim III..I: 1200 - 1499 LP)
     * 5: EMERALD (Lục Bảo III..I: 1500 - 1799 LP)
     * 6: DIAMOND (Kim Cương III..I: 1800 - 2099 LP)
     * 7: MASTER (Cao Thủ: 2100 - 2499 LP)
     * 8: GRANDMASTER (Đại Cao Thủ: 2500 - 2999 LP)
     * 9: CHALLENGER (Thách Đấu: 3000+ LP)
     */
    private int getTierLevel(int eloScore) {
        if (eloScore < 300) return 0;
        if (eloScore < 600) return 1;
        if (eloScore < 900) return 2;
        if (eloScore < 1200) return 3;
        if (eloScore < 1500) return 4;
        if (eloScore < 1800) return 5;
        if (eloScore < 2100) return 6;
        if (eloScore < 2500) return 7;
        if (eloScore < 3000) return 8;
        return 9;
    }

    private MatchResponse toMatchResponse(Match m) {
        return MatchResponse.builder()
                .id(m.getId())
                .sessionId(m.getSession().getId())
                .teamAPlayer1Id(m.getTeamAPlayer1().getId())
                .teamAPlayer1Name(m.getTeamAPlayer1().getFullName())
                .teamAPlayer2Id(m.getTeamAPlayer2() != null ? m.getTeamAPlayer2().getId() : null)
                .teamAPlayer2Name(m.getTeamAPlayer2() != null ? m.getTeamAPlayer2().getFullName() : null)
                .teamBPlayer1Id(m.getTeamBPlayer1().getId())
                .teamBPlayer1Name(m.getTeamBPlayer1().getFullName())
                .teamBPlayer2Id(m.getTeamBPlayer2() != null ? m.getTeamBPlayer2().getId() : null)
                .teamBPlayer2Name(m.getTeamBPlayer2() != null ? m.getTeamBPlayer2().getFullName() : null)
                .winningTeam(m.getWinningTeam())
                .courtName(m.getCourtName())
                .createdAt(m.getCreatedAt())
                .build();
    }
}
