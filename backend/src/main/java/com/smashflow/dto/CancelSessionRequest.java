package com.smashflow.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CancelSessionRequest {
    /** Lý do hủy ca (không bắt buộc), gửi kèm thông báo Telegram cho Host. */
    @Size(max = 500, message = "Lý do hủy ca tối đa 500 ký tự")
    private String reason;
}
