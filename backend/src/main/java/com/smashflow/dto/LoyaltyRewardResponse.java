package com.smashflow.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LoyaltyRewardResponse {
    private Long id;
    private Integer milestoneSessions;
    private String rewardName;
    private Boolean isClaimed;
    private String claimedAt;
}
