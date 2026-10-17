package com.smashflow.service;

import com.smashflow.model.Session;
import com.smashflow.model.SessionStatus;

import java.time.LocalDateTime;

/**
 * Trạng thái hiển thị của ca, tính theo giờ thực (5.2). DB chỉ lưu CANCELLED khi Host hủy ca;
 * các trạng thái còn lại suy ra từ giờ bắt đầu / kết thúc:
 *  - CANCELLED luôn thắng
 *  - now &lt; startTime → UPCOMING
 *  - startTime ≤ now ≤ endTime → ACTIVE
 *  - now &gt; endTime → COMPLETED
 */
public final class SessionStatusResolver {

    private SessionStatusResolver() {
    }

    public static SessionStatus effective(Session s, LocalDateTime now) {
        if (s.getStatus() == SessionStatus.CANCELLED) return SessionStatus.CANCELLED;
        if (s.getStartTime() != null && now.isBefore(s.getStartTime())) return SessionStatus.UPCOMING;
        if (s.getEndTime() != null && now.isAfter(s.getEndTime())) return SessionStatus.COMPLETED;
        if (s.getStartTime() == null || s.getEndTime() == null) {
            return s.getStatus() != null ? s.getStatus() : SessionStatus.UPCOMING;
        }
        return SessionStatus.ACTIVE;
    }

    public static SessionStatus effective(Session s) {
        return effective(s, LocalDateTime.now());
    }
}
