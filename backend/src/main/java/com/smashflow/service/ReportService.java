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

        List<SessionParticipant> participants = participantRepository.findBySessionId(sessionId);

        int totalPlayers = participants.size();
        int checkedIn = (int) participants.stream().filter(p -> p.getCheckinStatus() == CheckinStatus.CHECKED_IN).count();
        int paid = (int) participants.stream().filter(p -> p.getPaymentStatus() == PaymentStatus.PAID).count();
        int unpaid = totalPlayers - paid;

        // Total revenue = Paid final fees + Forfeited deposits from no-shows
        BigDecimal paidFees = participants.stream()
                .filter(p -> p.getPaymentStatus() == PaymentStatus.PAID)
                .map(SessionParticipant::getFinalFee)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal forfeitedDeposits = participants.stream()
                .filter(p -> p.getDepositStatus() == DepositStatus.FORFEITED)
                .map(SessionParticipant::getDepositAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalRevenue = paidFees.add(forfeitedDeposits);

        BigDecimal totalDepositCollected = participants.stream()
                .filter(p -> p.getDepositStatus() == DepositStatus.PAID || p.getDepositStatus() == DepositStatus.FORFEITED)
                .map(SessionParticipant::getDepositAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal costCourt = session.getCostCourt() != null ? session.getCostCourt() : BigDecimal.ZERO;
        BigDecimal costShuttle = session.getCostShuttlecock() != null ? session.getCostShuttlecock() : BigDecimal.ZERO;
        BigDecimal totalExpenses = costCourt.add(costShuttle);
        BigDecimal netProfit = totalRevenue.subtract(totalExpenses);

        // Compute Session MVP
        List<Match> matches = matchRepository.findBySessionIdOrderByCreatedAtDesc(sessionId);
        Map<Long, int[]> playerStats = new HashMap<>(); // userId -> [wins, losses]
        Map<Long, String> playerNames = new HashMap<>();

        for (Match m : matches) {
            boolean teamAWon = m.getWinningTeam() == WinningTeam.A;
            recordPlayerStats(playerStats, playerNames, m.getTeamAPlayer1(), teamAWon);
            if (m.getTeamAPlayer2() != null) recordPlayerStats(playerStats, playerNames, m.getTeamAPlayer2(), teamAWon);
            recordPlayerStats(playerStats, playerNames, m.getTeamBPlayer1(), !teamAWon);
            if (m.getTeamBPlayer2() != null) recordPlayerStats(playerStats, playerNames, m.getTeamBPlayer2(), !teamAWon);
        }

        Long mvpId = null;
        String mvpName = null;
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
                .totalExpenses(totalExpenses)
                .netProfit(netProfit)
                .mvpUserId(mvpId)
                .mvpName(mvpName)
                .mvpWins(maxWins)
                .mvpLosses(mvpLosses)
                .build();
    }

    private void recordPlayerStats(Map<Long, int[]> stats, Map<Long, String> names, User player, boolean won) {
        if (player == null) return;
        names.put(player.getId(), player.getFullName());
        int[] st = stats.computeIfAbsent(player.getId(), k -> new int[2]);
        if (won) {
            st[0]++;
        } else {
            st[1]++;
        }
    }
}
