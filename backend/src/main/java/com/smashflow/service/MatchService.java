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

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * Ghi / sửa / xóa trận và cập nhật LP.
 *
 * Toàn vẹn LP (5.1): mỗi trận lưu LP thực tế từng người nhận/mất (a1/a2/b1/b2_lp_delta).
 * Sửa/xóa trận có đủ delta → chỉ đảo ngược đúng phần LP + thắng/thua của trận đó (rồi áp kết quả mới khi sửa),
 * LP các trận khác và người khác không đổi.
 *  - Trận phân hạng: giảm placementMatches nếu trận đó được tính là trận phân hạng
 *    (người chơi có tổng số trận ≤ 5 tính cả trận này — placementMatches luôn = min(5, số trận)).
 *  - Chuỗi thắng/thua (currentStreak): tính lại chính xác từ lịch sử kết quả.
 *  - Khiên (shieldMatches): best-effort — đảo ngược trận thắng làm tụt đoàn (tức trận đó đã thăng hạng và cấp khiên)
 *    → khiên về 0; đảo ngược trận thua 0 LP đang ở đúng sàn đoàn (tức trận đó đã tiêu 1 khiên) → trả lại 1 khiên.
 *    Các trường hợp khác giữ nguyên khiên.
 * Trận cũ chưa có delta: tính lại lịch sử từng người bị ảnh hưởng theo thứ tự ID tăng dần, trận theo thời gian,
 * LP đồng đội / đối thủ lấy theo ảnh chụp lúc bắt đầu (kết quả không phụ thuộc thứ tự). Hạn chế: không phải
 * replay toàn CLB, LP đối thủ là giá trị hiện tại chứ không phải tại thời điểm trận.
 */
@Service
@RequiredArgsConstructor
public class MatchService {

    private static final int PLACEMENT_MATCHES = 5;

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

        Long pA1Id = request.getTeamAPlayer1Id();
        Long pA2Id = request.getTeamAPlayer2Id();
        Long pB1Id = request.getTeamBPlayer1Id();
        Long pB2Id = request.getTeamBPlayer2Id();

        validateDistinctPlayers(pA1Id, pA2Id, pB1Id, pB2Id);

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

        // Cập nhật thắng/thua/LP 4 người và lưu LP thực tế từng người vào trận
        applyResultAndStoreDeltas(match);
        matchRepository.save(match);

        return toMatchResponse(match);
    }

    /**
     * Delete (Undo) match: đảo ngược đúng phần LP / thắng-thua của trận rồi xóa bản ghi.
     */
    @Transactional
    public void deleteMatch(Long matchId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy trận đấu!"));

        Set<Long> affected = playerIds(match);

        if (hasAllDeltas(match)) {
            reverseMatch(match);
            matchRepository.delete(match);
            for (Long uId : sorted(affected)) {
                recomputeStreak(uId, matchId);
            }
        } else {
            // Trận cũ chưa có delta: tính lại lịch sử (bỏ trận này) cho người bị ảnh hưởng
            legacyReplay(affected, matchId);
            matchRepository.delete(match);
        }
    }

    /**
     * Update match (Switch winner, modify players, change court)
     */
    @Transactional
    public MatchResponse updateMatch(Long matchId, com.smashflow.dto.UpdateMatchRequest request) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy trận đấu!"));

        Long pA1Id = request.getTeamAPlayer1Id();
        Long pA2Id = request.getTeamAPlayer2Id();
        Long pB1Id = request.getTeamBPlayer1Id();
        Long pB2Id = request.getTeamBPlayer2Id();

        validateDistinctPlayers(pA1Id, pA2Id, pB1Id, pB2Id);

        User pA1 = userRepository.findById(pA1Id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy Player 1 Team A!"));
        User pA2 = pA2Id != null ? userRepository.findById(pA2Id).orElse(null) : null;
        User pB1 = userRepository.findById(pB1Id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy Player 1 Team B!"));
        User pB2 = pB2Id != null ? userRepository.findById(pB2Id).orElse(null) : null;

        validateRankDifference(pA1, pA2, pB1, pB2);

        // Người bị ảnh hưởng: đội hình cũ + đội hình mới
        Set<Long> affectedUserIds = new LinkedHashSet<>(playerIds(match));
        affectedUserIds.add(pA1.getId());
        if (pA2 != null) affectedUserIds.add(pA2.getId());
        affectedUserIds.add(pB1.getId());
        if (pB2 != null) affectedUserIds.add(pB2.getId());

        boolean exact = hasAllDeltas(match);
        if (exact) {
            // 1. Đảo ngược đúng LP / thắng-thua của kết quả cũ (trước khi đổi đội hình)
            reverseMatch(match);
            // Chuỗi thắng/thua "trước trận này" để áp lại kết quả mới
            for (Long uId : sorted(affectedUserIds)) {
                recomputeStreak(uId, matchId);
            }
        }

        match.setTeamAPlayer1(pA1);
        match.setTeamAPlayer2(pA2);
        match.setTeamBPlayer1(pB1);
        match.setTeamBPlayer2(pB2);
        match.setWinningTeam(request.getWinningTeam());
        if (request.getCourtName() != null && !request.getCourtName().isBlank()) {
            match.setCourtName(request.getCourtName());
        }

        if (exact) {
            // 2. Áp kết quả mới theo LP hiện tại (sau khi đã đảo ngược) và lưu delta mới
            applyResultAndStoreDeltas(match);
            matchRepository.save(match);
            for (Long uId : sorted(affectedUserIds)) {
                recomputeStreak(uId, null);
            }
        } else {
            clearDeltas(match);
            matchRepository.save(match);
            legacyReplay(affectedUserIds, null);
        }

        return toMatchResponse(match);
    }

    // ------------------------------------------------------------------
    // LP delta helpers
    // ------------------------------------------------------------------

    private static User[] players(Match m) {
        return new User[]{m.getTeamAPlayer1(), m.getTeamAPlayer2(), m.getTeamBPlayer1(), m.getTeamBPlayer2()};
    }

    private static Integer getDelta(Match m, int slot) {
        return switch (slot) {
            case 0 -> m.getA1LpDelta();
            case 1 -> m.getA2LpDelta();
            case 2 -> m.getB1LpDelta();
            default -> m.getB2LpDelta();
        };
    }

    private static void setDelta(Match m, int slot, Integer delta) {
        switch (slot) {
            case 0 -> m.setA1LpDelta(delta);
            case 1 -> m.setA2LpDelta(delta);
            case 2 -> m.setB1LpDelta(delta);
            default -> m.setB2LpDelta(delta);
        }
    }

    private static void clearDeltas(Match m) {
        for (int i = 0; i < 4; i++) setDelta(m, i, null);
    }

    /** Trận có đủ LP delta cho mọi vị trí có người chơi. */
    static boolean hasAllDeltas(Match m) {
        User[] ps = players(m);
        for (int i = 0; i < 4; i++) {
            if (ps[i] != null && getDelta(m, i) == null) return false;
        }
        return true;
    }

    private static Set<Long> playerIds(Match m) {
        Set<Long> ids = new LinkedHashSet<>();
        for (User u : players(m)) {
            if (u != null) ids.add(u.getId());
        }
        return ids;
    }

    private static List<Long> sorted(Set<Long> ids) {
        return new ArrayList<>(new TreeSet<>(ids));
    }

    private static boolean isWinner(Match m, int slot) {
        boolean teamA = slot < 2;
        return teamA == (m.getWinningTeam() == WinningTeam.A);
    }

    /** Áp kết quả trận cho 4 người (LP đội tính trước khi cập nhật ai) và ghi LP thực tế vào trận. */
    private void applyResultAndStoreDeltas(Match match) {
        int teamALp = calculateTeamAvgLp(match.getTeamAPlayer1(), match.getTeamAPlayer2());
        int teamBLp = calculateTeamAvgLp(match.getTeamBPlayer1(), match.getTeamBPlayer2());
        User[] ps = players(match);
        for (int i = 0; i < 4; i++) {
            User p = ps[i];
            if (p == null) {
                setDelta(match, i, null);
                continue;
            }
            boolean teamA = i < 2;
            int delta = applyMatchOutcome(p, isWinner(match, i), teamA ? teamALp : teamBLp, teamA ? teamBLp : teamALp);
            setDelta(match, i, delta);
        }
    }

    /** Đảo ngược đúng phần LP, thắng/thua, trận phân hạng (và khiên best-effort) của một trận có đủ delta. */
    private void reverseMatch(Match match) {
        User[] ps = players(match);
        for (int i = 0; i < 4; i++) {
            User u = ps[i];
            if (u == null) continue;
            int delta = getDelta(match, i);
            boolean won = isWinner(match, i);

            int before = u.getEloScore();
            int after = Math.max(0, before - delta);
            u.setEloScore(after);

            if (won) {
                u.setWinCount(Math.max(0, nz(u.getWinCount()) - 1));
            } else {
                u.setLossCount(Math.max(0, nz(u.getLossCount()) - 1));
            }

            // Trận phân hạng: placementMatches = min(5, số trận) → trận này là phân hạng khi tổng số trận (gồm trận này) ≤ 5
            long totalMatches = matchRepository.countAllByUserId(u.getId());
            int placement = nz(u.getPlacementMatches());
            boolean wasPlacement = totalMatches <= PLACEMENT_MATCHES && placement > 0;
            if (wasPlacement) {
                u.setPlacementMatches(placement - 1);
            } else {
                int shield = nz(u.getShieldMatches());
                if (won && getDivisionFloor(after) < getDivisionFloor(before)) {
                    // Trận thắng này đã đưa lên đoàn/bậc mới và cấp khiên → thu hồi
                    u.setShieldMatches(0);
                } else if (!won && delta == 0 && after > 0 && getDivisionFloor(after) == after) {
                    // Trận thua giữ ở sàn đoàn nhờ khiên → trả lại khiên đã tiêu
                    u.setShieldMatches(Math.min(3, shield + 1));
                }
            }
            userRepository.save(u);
        }
    }

    /** Chuỗi thắng/thua tính lại từ lịch sử kết quả (mới nhất trước). */
    private void recomputeStreak(Long userId, Long excludedMatchId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;
        List<Match> history = matchRepository.findAllByUserId(userId).stream()
                .filter(m -> excludedMatchId == null || !excludedMatchId.equals(m.getId()))
                .sorted(chronological().reversed())
                .toList();
        int streak = 0;
        for (Match m : history) {
            boolean won = isWinner(m, slotOf(m, userId));
            if (streak == 0) {
                streak = won ? 1 : -1;
            } else if (streak > 0 && won) {
                streak++;
            } else if (streak < 0 && !won) {
                streak--;
            } else {
                break;
            }
        }
        user.setCurrentStreak(streak);
        userRepository.save(user);
    }

    private static Comparator<Match> chronological() {
        return Comparator.comparing(Match::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(Match::getId, Comparator.nullsFirst(Comparator.naturalOrder()));
    }

    private static int slotOf(Match m, Long userId) {
        User[] ps = players(m);
        for (int i = 0; i < 4; i++) {
            if (ps[i] != null && userId.equals(ps[i].getId())) return i;
        }
        return -1;
    }

    /**
     * Trận cũ chưa có delta: tính lại lịch sử từng người bị ảnh hưởng (ID tăng dần, trận theo thời gian).
     * LP đồng đội / đối thủ lấy từ ảnh chụp trước khi tính lại → kết quả xác định, không phụ thuộc thứ tự.
     * LP người được tính lại ở mỗi trận ghi vào vị trí của người đó trên trận (để lần sửa sau dùng đường chính xác).
     */
    private void legacyReplay(Set<Long> affectedUserIds, Long excludedMatchId) {
        List<Long> ids = sorted(affectedUserIds);
        Map<Long, List<Match>> histories = new HashMap<>();
        Map<Long, Integer> snapshot = new HashMap<>();

        for (Long uId : ids) {
            List<Match> history = matchRepository.findAllByUserId(uId).stream()
                    .filter(m -> excludedMatchId == null || !excludedMatchId.equals(m.getId()))
                    .sorted(chronological())
                    .toList();
            histories.put(uId, history);
            for (Match m : history) {
                for (User p : players(m)) {
                    if (p != null) snapshot.putIfAbsent(p.getId(), p.getEloScore());
                }
            }
        }

        Set<Match> touched = new LinkedHashSet<>();
        for (Long uId : ids) {
            User user = userRepository.findById(uId).orElse(null);
            if (user == null) continue;

            user.setWinCount(0);
            user.setLossCount(0);
            user.setEloScore(0);
            user.setPlacementMatches(0);
            user.setCurrentStreak(0);
            user.setShieldMatches(0);

            for (Match m : histories.getOrDefault(uId, List.of())) {
                int slot = slotOf(m, uId);
                if (slot < 0) continue;
                boolean teamA = slot < 2;
                User[] ps = players(m);
                int myTeam = replayTeamLp(user, ps[teamA ? 0 : 2], ps[teamA ? 1 : 3], snapshot);
                int oppTeam = snapshotTeamLp(ps[teamA ? 2 : 0], ps[teamA ? 3 : 1], snapshot);
                int delta = applyMatchOutcome(user, isWinner(m, slot), myTeam, oppTeam);
                setDelta(m, slot, delta);
                touched.add(m);
            }
            userRepository.save(user);
        }
        if (!touched.isEmpty()) {
            matchRepository.saveAll(touched);
        }
    }

    /** LP đội của người đang tính lại: LP hiện tại của chính họ + LP ảnh chụp của đồng đội. */
    private static int replayTeamLp(User self, User p1, User p2, Map<Long, Integer> snapshot) {
        User partner = (p1 != null && self.getId().equals(p1.getId())) ? p2 : p1;
        if (partner == null) return self.getEloScore();
        return (self.getEloScore() + snapshot.getOrDefault(partner.getId(), partner.getEloScore())) / 2;
    }

    private static int snapshotTeamLp(User p1, User p2, Map<Long, Integer> snapshot) {
        int lp1 = snapshot.getOrDefault(p1.getId(), p1.getEloScore());
        if (p2 == null) return lp1;
        return (lp1 + snapshot.getOrDefault(p2.getId(), p2.getEloScore())) / 2;
    }

    private static int nz(Integer v) {
        return v != null ? v : 0;
    }

    private static void validateDistinctPlayers(Long pA1Id, Long pA2Id, Long pB1Id, Long pB2Id) {
        // All selected players in a match must be distinct
        Set<Long> playerIds = new java.util.HashSet<>();
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
    /** @return LP thực tế thay đổi của người chơi ở trận này (sau mọi luật phân hạng / khiên / sàn 0 LP). */
    private int applyMatchOutcome(User user, boolean isWin, int myTeamLp, int oppTeamLp) {
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
        return user.getEloScore() - currentLp;
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
