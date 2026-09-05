package com.smashflow.dto;

import com.smashflow.model.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SettlePaymentRequest {
    @NotNull(message = "ID người tham gia không được để trống")
    private Long participantId;

    @NotNull(message = "Phương thức thanh toán không được để trống")
    private PaymentMethod paymentMethod; // CASH or VIETQR
}
