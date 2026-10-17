package com.smashflow.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PermanentDeleteRequest {

    /** Host gõ lại đúng tên thành viên để xác nhận xóa vĩnh viễn. */
    @NotBlank(message = "Vui lòng nhập tên thành viên để xác nhận!")
    private String confirmName;
}
