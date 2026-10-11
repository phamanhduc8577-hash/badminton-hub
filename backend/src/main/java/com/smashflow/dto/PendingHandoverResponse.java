package com.smashflow.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/** Một phần quà vật lý member đã đủ điều kiện nhưng Host chưa trao. */
@Data
@Builder
public class PendingHandoverResponse {
    private Long rewardId;
    private Long userId;
    private String fullName;
    private String phone;
    private String avatarUrl;
    private Integer milestoneSessions;
    private String rewardName;
    private Integer sessionsAttended;
    private LocalDateTime createdAt;
}
