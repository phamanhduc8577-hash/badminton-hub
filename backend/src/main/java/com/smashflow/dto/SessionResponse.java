package com.smashflow.dto;

import com.smashflow.model.SessionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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

    private Boolean isBookedByCurrentUser;

    /** Trạng thái theo giờ thực: UPCOMING / ACTIVE / COMPLETED / CANCELLED (trùng với status). */
    private SessionStatus effectiveStatus;

    /** Giá dự kiến cho người xem đã đăng nhập (null với khách chưa đăng nhập). */
    private ViewerPricing viewerPricing;

    /** Người xem đã đăng nhập có phải đặt cọc khi tham gia không (null với khách chưa đăng nhập). */
    private Boolean requiresDeposit;

    private List<ParticipantResponse> participants;

    /** Giá gốc (trước voucher) mà người xem sẽ bị tính khi tham gia, dùng chung PricingCalculator với API join. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ViewerPricing {
        private boolean memberTier;
        private BigDecimal fullPrice;
        /** null khi ca không có giá 2h áp được cho hạng + giới tính của người xem. */
        private BigDecimal twoHourPrice;
    }
}
