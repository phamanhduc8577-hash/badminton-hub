package com.smashflow.dto;

import com.smashflow.model.Gender;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateGenderRequest {
    @NotNull(message = "Giới tính không được để trống")
    private Gender gender;
}
