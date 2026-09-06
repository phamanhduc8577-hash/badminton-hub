package com.smashflow.dto;

import com.smashflow.model.CheckinStatus;
import com.smashflow.model.DepositStatus;
import com.smashflow.model.Gender;
import com.smashflow.model.PaymentMethod;
import com.smashflow.model.PaymentStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class ParticipantResponse {
    private Long id;
    private Long sessionId;
    private Long userId;
    private Boolean isGuest;
    private String name;
    private String phone;
    private Gender gender;
    private CheckinStatus checkinStatus;
    private LocalDateTime checkinAt;
    private DepositStatus depositStatus;
    private BigDecimal depositAmount;
    private BigDecimal baseFee;
    private BigDecimal durationHours;
    private BigDecimal adjustmentAmount;
    private String adjustmentReason;
    private BigDecimal finalFee;
    private BigDecimal remainingAmount;
    private PaymentStatus paymentStatus;
    private PaymentMethod paymentMethod;
    private Integer winCount;
    private Integer lossCount;
    private Integer eloScore;
    private Integer placementMatches;
    private Integer currentStreak;
    private String avatarUrl;
}
