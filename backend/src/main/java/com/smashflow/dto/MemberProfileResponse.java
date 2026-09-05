package com.smashflow.dto;

import com.smashflow.model.Gender;
import com.smashflow.model.MembershipType;
import com.smashflow.model.Role;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class MemberProfileResponse {
    private Long id;
    private String phone;
    private String fullName;
    private Gender gender;
    private Role role;
    private MembershipType membershipType;
    private String avatarUrl;
    private Integer sessionsAttended;
    private Integer winCount;
    private Integer lossCount;
    private Double winRate;
    private Integer eloScore;
    private LocalDateTime createdAt;
}
