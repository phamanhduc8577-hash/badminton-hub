package com.smashflow.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AttendanceHistoryResponse {
    private Long sessionId;
    private String sessionTitle;
    private String venueName;
    private LocalDateTime checkinAt;
}
