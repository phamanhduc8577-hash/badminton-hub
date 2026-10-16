package com.smashflow.dto;

import com.smashflow.model.Gender;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    private String fullName;
    private String avatarUrl;
    private String phone;
    private String oldPassword;
    private String newPassword;
    /** Chỉ được tự sửa khi tài khoản chưa tham gia / thanh toán ca nào (xem GenderChangeService). */
    private Gender gender;
}
