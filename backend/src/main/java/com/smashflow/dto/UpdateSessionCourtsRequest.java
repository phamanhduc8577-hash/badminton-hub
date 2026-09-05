package com.smashflow.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateSessionCourtsRequest {
    @NotBlank(message = "Danh sách sân không được để trống")
    private String courtNames;

    private Integer maxSlots; // Tùy chọn nâng tổng slot tương ứng số sân (VD: 2 sân = 8 slots, 3 sân = 12-14 slots)
}
