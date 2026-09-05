package com.smashflow.dto;

import lombok.Data;

@Data
public class UpdateProfileRequest {
    private String fullName;
    private String avatarUrl;
    private String phone;
    private String oldPassword;
    private String newPassword;
}
