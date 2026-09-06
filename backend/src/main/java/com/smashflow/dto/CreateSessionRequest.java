package com.smashflow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class CreateSessionRequest {
    private Long venueId;

    // Custom Venue creation / selection
    private String venueName;
    private String venueAddress;
    private BigDecimal venueLatitude;
    private BigDecimal venueLongitude;
    private Integer venueRadiusMeters;

    @NotBlank(message = "Tiêu đề ca không được để trống")
    private String title;

    @NotNull(message = "Thời gian bắt đầu không được để trống")
    private LocalDateTime startTime;

    @NotNull(message = "Thời gian kết thúc không được để trống")
    private LocalDateTime endTime;

    private Integer maxSlots = 8;
    private Integer courtCount = 2;
    private String courtNames = "Sân 1, Sân 2";
    private BigDecimal memberMalePrice = new BigDecimal("50000");
    private BigDecimal memberFemalePrice = new BigDecimal("40000");
    private BigDecimal guestMalePrice = new BigDecimal("60000");
    private BigDecimal guestFemalePrice = new BigDecimal("50000");

    // Partial 2h sub-slot prices (for 3h/4h sessions)
    private BigDecimal memberMalePrice2h;
    private BigDecimal memberFemalePrice2h;
    private BigDecimal guestMalePrice2h;
    private BigDecimal guestFemalePrice2h;

    private BigDecimal depositAmount = new BigDecimal("20000");

    private BigDecimal costCourt = BigDecimal.ZERO;
    private BigDecimal costShuttlecock = BigDecimal.ZERO;
    private BigDecimal costDrinks = BigDecimal.ZERO;
}
