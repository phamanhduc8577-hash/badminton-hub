package com.smashflow.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "sepay_webhook_events", indexes = {
        @Index(name = "idx_sepay_transaction_id", columnList = "sepayTransactionId", unique = true),
        @Index(name = "idx_sepay_created_at", columnList = "createdAt")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SepayWebhookEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long sepayTransactionId;

    @Column(length = 50)
    private String gateway;

    @Column(length = 50)
    private String transactionDate;

    @Column(length = 50)
    private String accountNumber;

    @Column(length = 50)
    private String subAccount;

    @Column(length = 100)
    private String code;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(length = 20)
    private String transferType;

    @Column(precision = 14, scale = 2)
    private BigDecimal transferAmount;

    @Column(precision = 14, scale = 2)
    private BigDecimal accumulated;

    @Column(length = 100)
    private String referenceCode;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    @Builder.Default
    private Boolean matched = false;

    private Long matchedParticipantId;

    @Column(length = 50)
    private String matchedType; // DEPOSIT, FINAL_PAYMENT, NONE

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column(columnDefinition = "TEXT")
    private String rawPayload;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
