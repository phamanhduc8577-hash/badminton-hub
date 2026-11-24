package com.smashflow.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SepayWebhookResponse {
    private boolean success;
    private boolean matched;
    private String message;
    private Long participantId;
    private String paymentType; // DEPOSIT, FINAL_PAYMENT, NONE

    public SepayWebhookResponse(boolean success, String message) {
        this.success = success;
        this.message = message;
    }
}
