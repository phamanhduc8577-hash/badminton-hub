package com.smashflow.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForgotPasswordResponse {
    private String message;
    private String fullName;
    private String tempPassword;
    private Integer resetCountToday;
    private Integer maxResetPerDay;
}

