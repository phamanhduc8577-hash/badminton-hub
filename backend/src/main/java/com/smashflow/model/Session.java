package com.smashflow.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Session {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_id", nullable = false)
    private User host;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private SessionStatus status = SessionStatus.UPCOMING;

    @Column(nullable = false)
    @Builder.Default
    private Integer maxSlots = 8;

    @Column(nullable = false)
    @Builder.Default
    private Integer courtCount = 2;

    @Column(length = 100)
    @Builder.Default
    private String courtNames = "Sân 1, Sân 2";

    // Pricing rules per person
    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal memberMalePrice = new BigDecimal("50000");

    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal memberFemalePrice = new BigDecimal("40000");

    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal guestMalePrice = new BigDecimal("60000");

    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal guestFemalePrice = new BigDecimal("50000");

    // Partial duration prices (e.g. 2h sub-slot for 3h/4h sessions)
    @Column(precision = 10, scale = 2)
    private BigDecimal memberMalePrice2h;

    @Column(precision = 10, scale = 2)
    private BigDecimal memberFemalePrice2h;

    @Column(precision = 10, scale = 2)
    private BigDecimal guestMalePrice2h;

    @Column(precision = 10, scale = 2)
    private BigDecimal guestFemalePrice2h;

    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal depositAmount = new BigDecimal("20000"); // Cọc vãng lai

    // Host expense tracking
    @Column(precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal costCourt = BigDecimal.ZERO;

    @Column(precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal costShuttlecock = BigDecimal.ZERO;

    @Column(precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal costDrinks = BigDecimal.ZERO; // Tiền nước / trà đá

    // Dynamic QR Token for check-in
    private String checkinToken;
    private LocalDateTime tokenExpiresAt;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
