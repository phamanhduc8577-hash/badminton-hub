package com.smashflow.dto;

import com.smashflow.model.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class HostOverrideRequest {
    @NotNull(message = "ID người tham gia không được để trống")
    private Long participantId;

    private BigDecimal adjustmentAmount; // e.g., +20000 for drinks or -15000 for early leave
    private String adjustmentReason;
    private BigDecimal overrideFinalFee; // if host sets absolute amount directly
}
