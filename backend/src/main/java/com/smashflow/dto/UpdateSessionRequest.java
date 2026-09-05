package com.smashflow.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class UpdateSessionRequest {
    @NotBlank(message = "Tiêu đề ca không được để trống")
    private String title;

    private String venueName;
    private String venueAddress;

    private LocalDateTime startTime;
    private LocalDateTime endTime;

    private Integer maxSlots;
    private String courtNames;
    private Integer courtCount;

    private BigDecimal memberMalePrice;
    private BigDecimal memberFemalePrice;
    private BigDecimal guestMalePrice;
    private BigDecimal guestFemalePrice;

    private BigDecimal depositAmount;
    private BigDecimal costCourt;
    private BigDecimal costShuttlecock;
}
