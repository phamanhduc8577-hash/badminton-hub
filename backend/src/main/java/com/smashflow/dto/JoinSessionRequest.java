package com.smashflow.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class JoinSessionRequest {
    private BigDecimal durationHours; // e.g. 2.0 or 3.0 or null for full session
}
