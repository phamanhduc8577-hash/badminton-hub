package com.smashflow.dto;

import com.smashflow.model.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SelectPaymentMethodRequest {
    @NotNull(message = "Phương thức thanh toán không được để trống")
    private PaymentMethod paymentMethod;
}
