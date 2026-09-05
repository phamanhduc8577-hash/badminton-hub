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

        // Update Win/Loss Stats for all players
        if (request.getWinningTeam() == WinningTeam.A) {
            incrementWin(pA1);
            if (pA2 != null) incrementWin(pA2);
            incrementLoss(pB1);
            if (pB2 != null) incrementLoss(pB2);
        } else {
            incrementLoss(pA1);
            if (pA2 != null) incrementLoss(pA2);
            incrementWin(pB1);
            if (pB2 != null) incrementWin(pB2);
        }

        return toMatchResponse(match);
    }

    private void incrementWin(User user) {
        user.setWinCount(user.getWinCount() + 1);
        int currentElo = user.getEloScore();
        user.setEloScore(currentElo + 1);
        userRepository.save(user);
    }

    private void incrementLoss(User user) {
        user.setLossCount(user.getLossCount() + 1);
        int currentElo = user.getEloScore();
        // At Iron 0 LP (eloScore <= 0), loss does NOT decrease below 0 LP
        user.setEloScore(Math.max(0, currentElo - 1));
        userRepository.save(user);
    }

    private void validateRankDifference(User pA1, User pA2, User pB1, User pB2) {
        int tierA1 = getTierLevel(pA1.getEloScore());
        int tierA2 = pA2 != null ? getTierLevel(pA2.getEloScore()) : tierA1;
        int tierB1 = getTierLevel(pB1.getEloScore());
        int tierB2 = pB2 != null ? getTierLevel(pB2.getEloScore()) : tierB1;

        int avgTierA = (tierA1 + tierA2 + 1) / 2;
        int avgTierB = (tierB1 + tierB2 + 1) / 2;

        // Max tier gap allowed between opposing teams is 3 tiers (e.g., Gold vs Diamond max; Sắt cannot play with Thách Đấu)
        int tierGap = Math.abs(avgTierA - avgTierB);
        if (tierGap > 3) {
            throw new RuntimeException("Kèo đấu bị chênh lệch trình độ quá lớn (" + tierGap + " Bậc Rank)! Vui lòng cân bằng lại đội hình.");
        }
    }

    /**
     * Map LP Elo score to 10 Tier Levels:
     * 0: IRON (Sắt)
     * 1: BRONZE (Đồng)
     * 2: SILVER (Bạc)
     * 3: GOLD (Vàng)
     * 4: PLATINUM (Bạch Kim)
     * 5: DIAMOND (Kim Cương)
     * 6: MASTER (Cao Thủ)
     * 7: GRANDMASTER (Đại Cao Thủ)
     * 8: CHALLENGER (Thách Đấu)
     */
    private int getTierLevel(int eloScore) {
        if (eloScore <= 0) return 0; // Sắt
        if (eloScore <= 5) return 1; // Đồng
        if (eloScore <= 10) return 2; // Bạc
        if (eloScore <= 20) return 3; // Vàng
        if (eloScore <= 30) return 4; // Bạch Kim
        if (eloScore <= 50) return 5; // Kim Cương
        if (eloScore <= 75) return 6; // Cao Thủ
        if (eloScore <= 149) return 7; // Đại Cao Thủ
        return 8; // Thách Đấu
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
