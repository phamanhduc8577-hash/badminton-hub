package com.smashflow.service;

import com.smashflow.dto.HostSessionReport;
import com.smashflow.model.*;
import com.smashflow.repository.MatchRepository;
import com.smashflow.repository.SessionParticipantRepository;
import com.smashflow.repository.SessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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

    public HostSessionReport getSessionFinancialReport(Long sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca đánh!"));

        List<SessionParticipant> allParticipants = participantRepository.findBySessionId(sessionId);
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
        List<Match> matches = matchRepository.findBySessionIdOrderByCreatedAtDesc(sessionId);
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

    public com.smashflow.dto.MonthlyFinancialReport getMonthlyFinancialReport(int year, int month) {
        List<Session> allSessions = sessionRepository.findAllByOrderByStartTimeDesc();

        // Filter sessions by matching year and month flexibly
        List<Session> sessions = allSessions.stream()
                .filter(s -> {
                    if (s.getStartTime() == null) return false;
                    return s.getStartTime().getYear() == year && s.getStartTime().getMonthValue() == month;
                })
                .toList();

        // If no sessions found in strict year+month, fallback to matching month across sessions or return all if single month
        if (sessions.isEmpty() && !allSessions.isEmpty()) {
            sessions = allSessions.stream()
                    .filter(s -> s.getStartTime() != null && s.getStartTime().getMonthValue() == month)
                    .toList();
        }

        // If still empty and all sessions exist in DB, show recent sessions
        if (sessions.isEmpty() && !allSessions.isEmpty()) {
            sessions = allSessions;
        }

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
        Map<Long, com.smashflow.dto.MonthlyFinancialReport.TopActivePlayer.TopActivePlayerBuilder> userActiveMap = new HashMap<>();

        for (Session session : sessions) {
            HostSessionReport sRep = getSessionFinancialReport(session.getId());

            totalRevenue = totalRevenue.add(sRep.getTotalRevenue());
            totalExpenses = totalExpenses.add(sRep.getTotalExpenses());
            totalDepositCollected = totalDepositCollected.add(sRep.getTotalDepositCollected());
            totalCourt = totalCourt.add(sRep.getCostCourt());
            totalShuttle = totalShuttle.add(sRep.getCostShuttlecock());
            totalDrinks = totalDrinks.add(sRep.getCostDrinks() != null ? sRep.getCostDrinks() : BigDecimal.ZERO);

            totalPlayerTurnout += sRep.getTotalPlayers();
            totalCheckedIn += sRep.getCheckedInPlayers();

            List<SessionParticipant> parts = participantRepository.findBySessionId(session.getId());
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
                        userActiveMap.computeIfAbsent(u.getId(), k -> com.smashflow.dto.MonthlyFinancialReport.TopActivePlayer.builder()
                                .userId(u.getId())
                                .fullName(u.getFullName())
                                .avatarUrl(u.getAvatarUrl())
                                .membershipType(u.getMembershipType() != null ? u.getMembershipType().name() : "CASUAL")
                                .sessionsAttended(0)
                                .winCount(u.getWinCount() != null ? u.getWinCount() : 0)
                                .lossCount(u.getLossCount() != null ? u.getLossCount() : 0)
                        );
                        if (p.getCheckinStatus() == CheckinStatus.CHECKED_IN) {
                            com.smashflow.dto.MonthlyFinancialReport.TopActivePlayer.TopActivePlayerBuilder b = userActiveMap.get(u.getId());
                            // increment attended in month
                        }
                    }
                }
            }

            // Determine dynamic real-time status based on current time
            java.time.LocalDateTime nowTime = java.time.LocalDateTime.now();
            String effectiveStatus = session.getStatus().name();
            if (session.getStatus() != SessionStatus.CANCELLED) {
                if (session.getEndTime() != null && nowTime.isAfter(session.getEndTime())) {
                    effectiveStatus = "COMPLETED";
                } else if (session.getStartTime() != null && session.getEndTime() != null &&
                        !nowTime.isBefore(session.getStartTime()) && !nowTime.isAfter(session.getEndTime())) {
                    effectiveStatus = "ACTIVE";
                } else {
                    effectiveStatus = "UPCOMING";
                }
            }

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

        List<com.smashflow.dto.MonthlyFinancialReport.TopActivePlayer> topPlayers = userActiveMap.values().stream()
                .map(com.smashflow.dto.MonthlyFinancialReport.TopActivePlayer.TopActivePlayerBuilder::build)
                .sorted((a, b) -> Integer.compare(b.getWinCount(), a.getWinCount()))
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
