package com.smashflow.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "loyalty_rewards")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoyaltyReward {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private Integer milestoneSessions; // 5, 10, 20, 30

    @Column(nullable = false, length = 100)
    private String rewardName; // Quấn cán, Nước thể thao, Ống cầu

    @Column(nullable = false)
    @Builder.Default
    private Boolean isClaimed = false;

    private LocalDateTime claimedAt;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
