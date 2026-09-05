package com.smashflow.dto;

import com.smashflow.model.WinningTeam;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class MatchResponse {
    private Long id;
    private Long sessionId;

    private Long teamAPlayer1Id;
    private String teamAPlayer1Name;
    private Long teamAPlayer2Id;
    private String teamAPlayer2Name;

    private Long teamBPlayer1Id;
    private String teamBPlayer1Name;
    private Long teamBPlayer2Id;
    private String teamBPlayer2Name;

    private WinningTeam winningTeam;
    private String courtName;
    private LocalDateTime createdAt;
}
