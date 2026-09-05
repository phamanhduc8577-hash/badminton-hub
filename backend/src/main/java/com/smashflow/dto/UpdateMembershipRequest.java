package com.smashflow.dto;

import com.smashflow.model.MembershipType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateMembershipRequest {
    @NotNull(message = "Loại thành viên không được để trống")
    private MembershipType membershipType;
}
