package com.smashflow.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class CancelCheckinResponse {
    private ParticipantResponse participant;
    /** Các lưu ý cho Host, ví dụ quà mốc đã trao/đã dùng nên hệ thống giữ nguyên. */
    private List<String> notes;
}
