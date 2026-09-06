package com.smashflow.dto;

import com.smashflow.model.SessionStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class SessionResponse {
    private Long id;
    private Long venueId;
    private String venueName;
    private String venueAddress;
    private BigDecimal venueLatitude;
    private BigDecimal venueLongitude;
    private Integer venueRadiusMeters;

    private Long hostId;
    private String hostName;

    private String title;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private SessionStatus status;
    private Integer maxSlots;
    private Integer courtCount;
    private String courtNames;
    private Integer bookedSlots;
    private Integer checkedInSlots;

    private BigDecimal memberMalePrice;
    private BigDecimal memberFemalePrice;
    private BigDecimal guestMalePrice;
    private BigDecimal guestFemalePrice;

    private BigDecimal memberMalePrice2h;
    private BigDecimal memberFemalePrice2h;
    private BigDecimal guestMalePrice2h;
    private BigDecimal guestFemalePrice2h;

    private BigDecimal depositAmount;

    private BigDecimal costCourt;
    private BigDecimal costShuttlecock;
    private BigDecimal costDrinks;

    private String checkinToken;
    private LocalDateTime tokenExpiresAt;

    private List<ParticipantResponse> participants;
}
