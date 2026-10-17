package com.smashflow.dto;

import lombok.Data;

@Data
public class UndoPaymentRequest {
    /** Lý do hoàn tác thu tiền (bắt buộc, kiểm tra ở service để trả đúng thông báo). */
    private String reason;
}
