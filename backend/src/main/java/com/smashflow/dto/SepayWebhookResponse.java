package com.smashflow.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SepayWebhookResponse {

    private boolean success;
    private boolean matched;
    private String message;
    private Long participantId;
    private String paymentType; // DEPOSIT, FINAL_PAYMENT, NONE
}
