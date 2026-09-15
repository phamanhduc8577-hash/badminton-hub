package com.smashflow.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class MonthlyFinancialReport {
    private Integer year;
    private Integer month;

    // Financial KPIs
    private BigDecimal totalRevenue;
    private BigDecimal totalExpenses;
    private BigDecimal netProfit;
    private BigDecimal totalDepositCollected;
    private BigDecimal costCourt;
    private BigDecimal costShuttlecock;
    private BigDecimal costDrinks;

    // Headcount & Attendance KPIs
    private Integer totalSessions;
    private Integer totalPlayerTurnout;
    private Integer checkedInPlayers;
    private Double attendanceRate; // checkedIn / totalTurnout %

    // Player Demographics
    private Integer fixedMemberTurnout;
    private Integer guestTurnout;
    private Integer maleTurnout;
    private Integer femaleTurnout;

    // Payment Breakdowns
    private Integer vietQrPayments;
    private Integer cashPayments;
    private Integer unpaidCount;

    // Per-session summary items
    private List<SessionFinancialSummary> sessionSummaries;

    // Top active players in month
    private List<TopActivePlayer> topPlayers;

    @Data
    @Builder
    public static class SessionFinancialSummary {
        private Long sessionId;
        private String title;
        private String startTime;
        private String endTime;
        private String status;
        private Integer totalPlayers;
        private Integer checkedInPlayers;
        private BigDecimal totalRevenue;
        private BigDecimal totalExpenses;
        private BigDecimal netProfit;
        private String mvpName;
    }

    @Data
    @Builder
    public static class TopActivePlayer {
        private Long userId;
        private String fullName;
        private String avatarUrl;
        private String membershipType;
        private Integer sessionsAttended;
        private Integer winCount;
        private Integer lossCount;
    }
}
