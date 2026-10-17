package com.smashflow.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "session_participants")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private Session session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isGuest = false;

    private String guestName;
    private String guestPhone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private Gender gender = Gender.MALE;

    // Checkin flow
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private CheckinStatus checkinStatus = CheckinStatus.PENDING;

    private LocalDateTime checkinAt;

    // Deposit flow (for guest)
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private DepositStatus depositStatus = DepositStatus.NONE;

    @Column(precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal depositAmount = BigDecimal.ZERO;

    // Final Pricing & Host Override
    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal baseFee = BigDecimal.ZERO;

    @Column(precision = 5, scale = 1)
    private BigDecimal durationHours; // e.g. 2.0 or full ca

    @Column(length = 50)
    private String slotWindow; // e.g. "13:00 - 15:00 (Về sớm)" or "14:00 - 16:00 (Đến muộn)" or "FULL"

    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal adjustmentAmount = BigDecimal.ZERO;

    private String adjustmentReason;

    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal finalFee = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.UNPAID;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private PaymentMethod paymentMethod;

    /** Thời điểm Host bấm "Đã thu" (null = chưa thu, hoặc lượt thu trước khi có cột này). */
    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    /** ID Host đã thu tiền lượt này. */
    @Column(name = "paid_by")
    private Long paidBy;

    /** Phần thưởng voucher đã tự áp khi đăng ký (để hoàn đúng mốc khi hủy slot). */
    @Column(name = "voucher_reward_id")
    private Long voucherRewardId;

    @Column(nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    /** Tiền còn phải thu: chỉ trừ cọc khi cọc đã được Host xác nhận (PAID). */
    public BigDecimal getRemainingPaymentAmount() {
        return com.smashflow.service.PricingCalculator.remainingAmount(this);
    }
}
