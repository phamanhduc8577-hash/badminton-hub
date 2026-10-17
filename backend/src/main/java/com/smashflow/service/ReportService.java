package com.smashflow.service;

import com.smashflow.dto.HostSessionReport;
import com.smashflow.dto.ReconciliationEntry;
import com.smashflow.model.*;
import com.smashflow.repository.MatchRepository;
import com.smashflow.repository.SessionParticipantRepository;
import com.smashflow.repository.SessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final SessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final MatchRepository matchRepository;

    @Transactional(readOnly = true)
    public HostSessionReport getSessionFinancialReport(Long sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca đánh!"));
        return buildSessionReport(session,
                participantRepository.findBySessionId(sessionId),
                matchRepository.findBySessionIdOrderByCreatedAtDesc(sessionId));
    }

    private HostSessionReport buildSessionReport(Session session, List<SessionParticipant> allParticipants, List<Match> matches) {
        List<SessionParticipant> activeParticipants = allParticipants.stream()
                .filter(p -> p.getCheckinStatus() != CheckinStatus.ABSENT)
                .toList();

        int totalPlayers = activeParticipants.size();
        int checkedIn = (int) activeParticipants.stream().filter(p -> p.getCheckinStatus() == CheckinStatus.CHECKED_IN).count();
        int paid = (int) activeParticipants.stream().filter(p -> p.getPaymentStatus() == PaymentStatus.PAID).count();
        int unpaid = totalPlayers - paid;

        // Total revenue = Paid final fees from active players + Forfeited deposits from cancelled no-shows
        BigDecimal paidFees = activeParticipants.stream()
                .filter(p -> p.getPaymentStatus() == PaymentStatus.PAID)
                .map(SessionParticipant::getFinalFee)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal forfeitedDeposits = allParticipants.stream()
                .filter(p -> p.getDepositStatus() == DepositStatus.FORFEITED)
                .map(SessionParticipant::getDepositAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalRevenue = paidFees.add(forfeitedDeposits);

        BigDecimal totalDepositCollected = allParticipants.stream()
                .filter(p -> p.getDepositStatus() == DepositStatus.PAID || p.getDepositStatus() == DepositStatus.FORFEITED)
                .map(SessionParticipant::getDepositAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal costCourt = session.getCostCourt() != null ? session.getCostCourt() : BigDecimal.ZERO;
        BigDecimal costShuttle = session.getCostShuttlecock() != null ? session.getCostShuttlecock() : BigDecimal.ZERO;
        BigDecimal costDrinks = session.getCostDrinks() != null ? session.getCostDrinks() : BigDecimal.ZERO;
        BigDecimal totalExpenses = costCourt.add(costShuttle).add(costDrinks);
        BigDecimal netProfit = totalRevenue.subtract(totalExpenses);

        // Compute Session MVP
        Map<Long, int[]> playerStats = new HashMap<>(); // userId -> [wins, losses]
        Map<Long, String> playerNames = new HashMap<>();
        Map<Long, String> playerAvatars = new HashMap<>();

        for (Match m : matches) {
            boolean teamAWon = m.getWinningTeam() == WinningTeam.A;
            recordPlayerStats(playerStats, playerNames, playerAvatars, m.getTeamAPlayer1(), teamAWon);
            if (m.getTeamAPlayer2() != null) recordPlayerStats(playerStats, playerNames, playerAvatars, m.getTeamAPlayer2(), teamAWon);
            recordPlayerStats(playerStats, playerNames, playerAvatars, m.getTeamBPlayer1(), !teamAWon);
            if (m.getTeamBPlayer2() != null) recordPlayerStats(playerStats, playerNames, playerAvatars, m.getTeamBPlayer2(), !teamAWon);
        }

        Long mvpId = null;
        String mvpName = null;
        String mvpAvatarUrl = null;
        int maxWins = 0;
        int mvpLosses = 0;

        for (Map.Entry<Long, int[]> entry : playerStats.entrySet()) {
            int wins = entry.getValue()[0];
            int losses = entry.getValue()[1];
            if (wins > maxWins || (wins == maxWins && wins > 0 && losses < mvpLosses)) {
                maxWins = wins;
                mvpLosses = losses;
                mvpId = entry.getKey();
                mvpName = playerNames.get(mvpId);
                mvpAvatarUrl = playerAvatars.get(mvpId);
            }
        }

        return HostSessionReport.builder()
                .sessionId(session.getId())
                .title(session.getTitle())
                .totalPlayers(totalPlayers)
                .checkedInPlayers(checkedIn)
                .paidPlayers(paid)
                .unpaidPlayers(unpaid)
                .totalRevenue(totalRevenue)
                .totalDepositCollected(totalDepositCollected)
                .costCourt(costCourt)
                .costShuttlecock(costShuttle)
                .costDrinks(costDrinks)
                .totalExpenses(totalExpenses)
                .netProfit(netProfit)
                .mvpUserId(mvpId)
                .mvpName(mvpName)
                .mvpAvatarUrl(mvpAvatarUrl)
                .mvpWins(maxWins)
                .mvpLosses(mvpLosses)
                .build();
    }

    private void recordPlayerStats(Map<Long, int[]> stats, Map<Long, String> names, Map<Long, String> avatars, User player, boolean won) {
        if (player == null) return;
        names.put(player.getId(), player.getFullName());
        if (player.getAvatarUrl() != null && !player.getAvatarUrl().isBlank()) {
            avatars.put(player.getId(), player.getAvatarUrl());
        }
        int[] st = stats.computeIfAbsent(player.getId(), k -> new int[2]);
        if (won) {
            st[0]++;
        } else {
            st[1]++;
        }
    }

    private void recordMonthMatch(Map<Long, int[]> stats, Map<Long, User> users, User player, boolean won) {
        if (player == null) return;
        users.putIfAbsent(player.getId(), player);
        int[] st = stats.computeIfAbsent(player.getId(), k -> new int[3]);
        if (won) {
            st[1]++;
        } else {
            st[2]++;
        }
    }

    /**
     * Đối soát cọc (Q5, chỉ đọc): lượt đã thu tiền có cọc, thu trước bản sửa lỗi (paid_at trống).
     * Các lượt này có thể đã bị thu thiếu đúng bằng tiền cọc nếu cọc thực tế chưa nhận.
     */
    @Transactional(readOnly = true)
    public List<ReconciliationEntry> getDepositReconciliation() {
        return participantRepository.findLegacyPaidWithDeposit().stream()
                .map(p -> {
                    User u = p.getUser();
                    String name = (u != null && u.getFullName() != null && !u.getFullName().isBlank())
                            ? u.getFullName()
                            : (p.getGuestName() != null && !p.getGuestName().isBlank() ? p.getGuestName() : "N/A");
                    String phone = (u != null && u.getPhone() != null && !u.getPhone().isBlank())
                            ? u.getPhone()
                            : (p.getGuestPhone() != null && !p.getGuestPhone().isBlank() ? p.getGuestPhone() : "N/A");
                    return ReconciliationEntry.builder()
                            .participantId(p.getId())
                            .sessionId(p.getSession().getId())
                            .sessionTitle(p.getSession().getTitle())
                            .sessionStartTime(p.getSession().getStartTime())
                            .name(name)
                            .phone(phone)
                            .finalFee(p.getFinalFee())
                            .depositAmount(p.getDepositAmount())
                            .depositStatus(p.getDepositStatus())
                            .paymentMethod(p.getPaymentMethod())
                            .build();
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public com.smashflow.dto.MonthlyFinancialReport getMonthlyFinancialReport(int year, int month) {
        // Chỉ các ca có giờ bắt đầu nằm trong tháng; tháng không có ca → báo cáo rỗng (không lấy tháng khác)
        java.time.LocalDateTime monthStart = java.time.LocalDate.of(year, month, 1).atStartOfDay();
        java.time.LocalDateTime monthEnd = monthStart.plusMonths(1).minusNanos(1);
        List<Session> sessions = sessionRepository.findByStartTimeBetweenOrderByStartTimeDesc(monthStart, monthEnd);

        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalExpenses = BigDecimal.ZERO;
        BigDecimal totalDepositCollected = BigDecimal.ZERO;
        BigDecimal totalCourt = BigDecimal.ZERO;
        BigDecimal totalShuttle = BigDecimal.ZERO;
        BigDecimal totalDrinks = BigDecimal.ZERO;

        int totalPlayerTurnout = 0;
        int totalCheckedIn = 0;
        int fixedMemberTurnout = 0;
        int guestTurnout = 0;
        int maleTurnout = 0;
        int femaleTurnout = 0;
        int vietQrPayments = 0;
        int cashPayments = 0;
        int unpaidCount = 0;

        List<com.smashflow.dto.MonthlyFinancialReport.SessionFinancialSummary> summaries = new java.util.ArrayList<>();
        // Thống kê theo tháng: userId -> [số ca điểm danh, thắng, thua] (chỉ tính trong các ca của tháng)
        Map<Long, int[]> monthStats = new HashMap<>();
        Map<Long, User> monthUsers = new HashMap<>();

        // Nạp gộp lượt đăng ký + trận của mọi ca trong tháng (2 truy vấn thay vì 3 truy vấn × số ca)
        List<Long> sessionIds = sessions.stream().map(Session::getId).toList();
        Map<Long, List<SessionParticipant>> partsBySession = new HashMap<>();
        Map<Long, List<Match>> matchesBySession = new HashMap<>();
        if (!sessionIds.isEmpty()) {
            for (SessionParticipant p : participantRepository.findBySessionIdInWithUser(sessionIds)) {
                partsBySession.computeIfAbsent(p.getSession().getId(), k -> new java.util.ArrayList<>()).add(p);
            }
            for (Match m : matchRepository.findBySessionIdIn(sessionIds)) {
                matchesBySession.computeIfAbsent(m.getSession().getId(), k -> new java.util.ArrayList<>()).add(m);
            }
        }
        java.time.LocalDateTime nowTime = java.time.LocalDateTime.now();

        for (Session session : sessions) {
            List<SessionParticipant> parts = partsBySession.getOrDefault(session.getId(), List.of());
            List<Match> sessionMatches = matchesBySession.getOrDefault(session.getId(), List.of());
            HostSessionReport sRep = buildSessionReport(session, parts, sessionMatches);

            totalRevenue = totalRevenue.add(sRep.getTotalRevenue());
            totalExpenses = totalExpenses.add(sRep.getTotalExpenses());
            totalDepositCollected = totalDepositCollected.add(sRep.getTotalDepositCollected());
            totalCourt = totalCourt.add(sRep.getCostCourt());
            totalShuttle = totalShuttle.add(sRep.getCostShuttlecock());
            totalDrinks = totalDrinks.add(sRep.getCostDrinks() != null ? sRep.getCostDrinks() : BigDecimal.ZERO);

            totalPlayerTurnout += sRep.getTotalPlayers();
            totalCheckedIn += sRep.getCheckedInPlayers();

            for (SessionParticipant p : parts) {
                if (p.getCheckinStatus() != CheckinStatus.ABSENT) {
                    if (p.getIsGuest() != null && p.getIsGuest()) {
                        guestTurnout++;
                    } else {
                        fixedMemberTurnout++;
                    }

                    if (p.getGender() == Gender.FEMALE) {
                        femaleTurnout++;
                    } else {
                        maleTurnout++;
                    }

                    if (p.getPaymentStatus() == PaymentStatus.PAID) {
                        if (p.getPaymentMethod() == PaymentMethod.CASH) {
                            cashPayments++;
                        } else {
                            vietQrPayments++;
                        }
                    } else {
                        unpaidCount++;
                    }

                    if (p.getUser() != null) {
                        User u = p.getUser();
                        monthUsers.putIfAbsent(u.getId(), u);
                        int[] st = monthStats.computeIfAbsent(u.getId(), k -> new int[3]);
                        if (p.getCheckinStatus() == CheckinStatus.CHECKED_IN) {
                            st[0]++;
                        }
                    }
                }
            }

            // Thắng/thua trong các trận của ca này
            for (Match m : sessionMatches) {
                boolean teamAWon = m.getWinningTeam() == WinningTeam.A;
                recordMonthMatch(monthStats, monthUsers, m.getTeamAPlayer1(), teamAWon);
                recordMonthMatch(monthStats, monthUsers, m.getTeamAPlayer2(), teamAWon);
                recordMonthMatch(monthStats, monthUsers, m.getTeamBPlayer1(), !teamAWon);
                recordMonthMatch(monthStats, monthUsers, m.getTeamBPlayer2(), !teamAWon);
            }

            // Trạng thái theo giờ thực (dùng chung quy tắc với API ca)
            String effectiveStatus = SessionStatusResolver.effective(session, nowTime).name();

            summaries.add(com.smashflow.dto.MonthlyFinancialReport.SessionFinancialSummary.builder()
                    .sessionId(session.getId())
                    .title(session.getTitle())
                    .startTime(session.getStartTime() != null ? session.getStartTime().toString() : null)
                    .endTime(session.getEndTime() != null ? session.getEndTime().toString() : null)
                    .status(effectiveStatus)
                    .totalPlayers(sRep.getTotalPlayers())
                    .checkedInPlayers(sRep.getCheckedInPlayers())
                    .totalRevenue(sRep.getTotalRevenue())
                    .totalExpenses(sRep.getTotalExpenses())
                    .netProfit(sRep.getNetProfit())
                    .mvpName(sRep.getMvpName())
                    .build());
        }

        BigDecimal netProfit = totalRevenue.subtract(totalExpenses);
        double attRate = totalPlayerTurnout > 0 ? (double) totalCheckedIn / totalPlayerTurnout * 100.0 : 0.0;

        // Top người chơi: theo số trận thắng trong tháng, rồi số ca đi trong tháng
        List<com.smashflow.dto.MonthlyFinancialReport.TopActivePlayer> topPlayers = monthStats.entrySet().stream()
                .filter(e -> e.getValue()[0] > 0 || e.getValue()[1] + e.getValue()[2] > 0)
                .map(e -> {
                    User u = monthUsers.get(e.getKey());
                    int[] st = e.getValue();
                    return com.smashflow.dto.MonthlyFinancialReport.TopActivePlayer.builder()
                            .userId(u.getId())
                            .fullName(u.getFullName())
                            .avatarUrl(u.getAvatarUrl())
                            .membershipType(u.getMembershipType() != null ? u.getMembershipType().name() : "CASUAL")
                            .sessionsAttended(st[0])
                            .winCount(st[1])
                            .lossCount(st[2])
                            .build();
                })
                .sorted(java.util.Comparator
                        .comparing(com.smashflow.dto.MonthlyFinancialReport.TopActivePlayer::getWinCount).reversed()
                        .thenComparing(com.smashflow.dto.MonthlyFinancialReport.TopActivePlayer::getSessionsAttended, java.util.Comparator.reverseOrder())
                        .thenComparing(com.smashflow.dto.MonthlyFinancialReport.TopActivePlayer::getLossCount))
                .limit(8)
                .toList();

        return com.smashflow.dto.MonthlyFinancialReport.builder()
                .year(year)
                .month(month)
                .totalRevenue(totalRevenue)
                .totalExpenses(totalExpenses)
                .netProfit(netProfit)
                .totalDepositCollected(totalDepositCollected)
                .costCourt(totalCourt)
                .costShuttlecock(totalShuttle)
                .costDrinks(totalDrinks)
                .totalSessions(sessions.size())
                .totalPlayerTurnout(totalPlayerTurnout)
                .checkedInPlayers(totalCheckedIn)
                .attendanceRate(Math.round(attRate * 10.0) / 10.0)
                .fixedMemberTurnout(fixedMemberTurnout)
                .guestTurnout(guestTurnout)
                .maleTurnout(maleTurnout)
                .femaleTurnout(femaleTurnout)
                .vietQrPayments(vietQrPayments)
                .cashPayments(cashPayments)
                .unpaidCount(unpaidCount)
                .sessionSummaries(summaries)
                .topPlayers(topPlayers)
                .build();
    }
}
