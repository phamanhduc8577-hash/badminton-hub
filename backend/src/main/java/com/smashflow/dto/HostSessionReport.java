package com.smashflow.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class HostSessionReport {
    private Long sessionId;
    private String title;
    private Integer totalPlayers;
    private Integer checkedInPlayers;
    private Integer paidPlayers;
    private Integer unpaidPlayers;

    private BigDecimal totalRevenue;
    private BigDecimal totalDepositCollected;
    private BigDecimal costCourt;
    private BigDecimal costShuttlecock;
    private BigDecimal costDrinks;
    private BigDecimal totalExpenses;
    private BigDecimal netProfit;

    // MVP of the session
    private Long mvpUserId;
    private String mvpName;
    private String mvpAvatarUrl;
    private Integer mvpWins;
    private Integer mvpLosses;
    private Boolean mvpRewardGiven;
}
