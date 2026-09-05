package com.smashflow.dto;

import com.smashflow.model.Gender;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LeaderboardEntry {
    private Long id;
    private String fullName;
    private String phone;
    private Gender gender;
    private String avatarUrl;
    private Integer sessionsAttended;
    private Integer winCount;
    private Integer lossCount;
    private Double winRate;
    private Integer eloScore;
    private Integer rank;
}
