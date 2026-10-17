package com.smashflow.dto;

import com.smashflow.model.DepositStatus;
import com.smashflow.model.PaymentMethod;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Một dòng đối soát cọc: lượt đã thu tiền + có cọc, thu trước bản sửa lỗi trừ cọc (paidAt = null). */
@Data
@Builder
public class ReconciliationEntry {
    private Long participantId;
    private Long sessionId;
    private String sessionTitle;
    private LocalDateTime sessionStartTime;
    private String name;
    private String phone;
    private BigDecimal finalFee;
    private BigDecimal depositAmount;
    private DepositStatus depositStatus;
    private PaymentMethod paymentMethod;
}
