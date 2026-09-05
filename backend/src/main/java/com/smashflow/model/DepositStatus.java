package com.smashflow.model;

public enum DepositStatus {
    NONE,
    PENDING,
    PAID,
    FORFEITED, // Đã cọc nhưng vắng mặt / hủy kèo (giữ tiền cọc vào doanh thu)
    REFUNDED
}
