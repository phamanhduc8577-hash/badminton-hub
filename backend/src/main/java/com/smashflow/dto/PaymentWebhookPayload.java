package com.smashflow.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Standard Webhook Payload for Banking/Payment Gateways (e.g. SePay, Casso, VietQR).
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PaymentWebhookPayload {
    private Long id;
    private String gateway; // e.g. "MBBank", "Vietcombank", "SePay"
    private String transactionDate;
    private String accountNumber;
    private String subAccount;
    private BigDecimal transferAmount;
    private String content; // Bank Transfer Memo, e.g. "COC 5 0901234567" or "PAY 5 0901234567"
    private String transferType; // "in"
    private String referenceCode;
}
