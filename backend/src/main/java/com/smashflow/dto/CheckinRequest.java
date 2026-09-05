package com.smashflow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CheckinRequest {
    @NotBlank(message = "Mã token điểm danh không được để trống")
    private String token;

    @NotNull(message = "Vĩ độ GPS không được để trống")
    private BigDecimal latitude;

    @NotNull(message = "Kinh độ GPS không được để trống")
    private BigDecimal longitude;

    private BigDecimal durationHours;
}
