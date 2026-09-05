package com.smashflow.dto;

import com.smashflow.model.WinningTeam;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateMatchRequest {
    @NotNull(message = "ID ca đánh không được để trống")
    private Long sessionId;

    @NotNull(message = "Player 1 Team A không được để trống")
    private Long teamAPlayer1Id;

    private Long teamAPlayer2Id;

    @NotNull(message = "Player 1 Team B không được để trống")
    private Long teamBPlayer1Id;

    private Long teamBPlayer2Id;

    @NotNull(message = "Đội thắng không được để trống")
    private WinningTeam winningTeam; // A or B

    private String courtName; // Optional court identifier: "Sân 1", "Sân 2", etc.
}
