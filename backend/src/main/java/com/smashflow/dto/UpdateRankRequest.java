package com.smashflow.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateRankRequest {
    @NotNull(message = "Điểm Elo LP không được để trống")
    private Integer eloScore;

    private Integer placementMatches;
}
