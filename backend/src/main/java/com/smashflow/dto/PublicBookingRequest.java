package com.smashflow.dto;

import com.smashflow.model.Gender;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PublicBookingRequest {
    @NotBlank(message = "Họ tên không được để trống")
    private String guestName;

    @NotBlank(message = "Số điện thoại không được để trống")
    @jakarta.validation.constraints.Pattern(regexp = "^(0[35789])[0-9]{8}$", message = "Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 số (VD: 0901234567, 03..., 05..., 07..., 08...)")
    private String guestPhone;

    @NotNull(message = "Giới tính không được để trống")
    private Gender gender;

    private java.math.BigDecimal durationHours; // e.g. 2.0 or null for full ca
    private String slotWindow; // e.g. "13:00 - 15:00 (Về sớm)"
}
