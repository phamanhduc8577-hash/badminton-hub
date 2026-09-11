package com.smashflow.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CheckinRequest {
    @NotBlank(message = "Mã token điểm danh không được để trống")
    private String token;

    private BigDecimal latitude;
    private BigDecimal longitude;
    private BigDecimal durationHours;
}
