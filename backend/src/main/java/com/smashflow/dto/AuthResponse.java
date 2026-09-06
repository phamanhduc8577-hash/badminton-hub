package com.smashflow.dto;

import com.smashflow.model.Gender;
import com.smashflow.model.Role;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthResponse {
    private String token;
    private Long id;
    private String phone;
    private String fullName;
    private Gender gender;
    private Role role;
    private com.smashflow.model.MembershipType membershipType;
    private Integer sessionsAttended;
    private Integer winCount;
    private Integer lossCount;
    private Double winRate;
    private Integer eloScore;
    private Integer placementMatches;
    private Integer currentStreak;
    private String avatarUrl;
}
