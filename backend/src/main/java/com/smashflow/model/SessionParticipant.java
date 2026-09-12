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

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public BigDecimal getRemainingPaymentAmount() {
        if (paymentStatus == PaymentStatus.PAID) {
            return BigDecimal.ZERO;
        }
        BigDecimal remaining = finalFee.subtract(depositAmount != null ? depositAmount : BigDecimal.ZERO);
        return remaining.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : remaining;
    }
}
