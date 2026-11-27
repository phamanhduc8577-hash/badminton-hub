package com.smashflow.service;

import com.smashflow.model.SessionParticipant;
import com.smashflow.model.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SessionMemoTest {

    @Test
    @DisplayName("sanitizeNameForMemo: Gỡ bỏ dấu tiếng Việt chuẩn hóa sang chữ hoa không dấu")
    void testSanitizeNameForMemo() {
        assertEquals("NGUYEN VAN DAT", SessionService.sanitizeNameForMemo("Nguyễn Văn Đạt"));
        assertEquals("LE THI DUNG", SessionService.sanitizeNameForMemo("Lê Thị Dũng"));
        assertEquals("TRAN DUC BO", SessionService.sanitizeNameForMemo("Trần Đức Bo"));
        assertEquals("HOANG ANH", SessionService.sanitizeNameForMemo("Hoàng   Ánh  "));
        assertEquals("", SessionService.sanitizeNameForMemo(null));
        assertEquals("", SessionService.sanitizeNameForMemo("   "));
        // Ký tự đặc biệt bị loại bỏ, khoảng trắng kép gom thành đơn
        assertEquals("PHAM ANH DUC", SessionService.sanitizeNameForMemo("Phạm Anh Đức (VIP)"));
    }

    @Test
    @DisplayName("depositMemo: Ghép mã COC SF và tên không dấu")
    void testDepositMemoWithParticipant() {
        User user = User.builder().fullName("Nguyễn Hoàng Long").build();
        SessionParticipant participant = SessionParticipant.builder()
                .id(99L)
                .user(user)
                .build();

        assertEquals("COC SF99 NGUYEN HOANG LONG", SessionService.depositMemo(participant));

        // Khách vãng lai không có User nhưng có guestName
        SessionParticipant guest = SessionParticipant.builder()
                .id(102L)
                .guestName("Đỗ Quỳnh Nga")
                .build();

        assertEquals("COC SF102 DO QUYNH NGA", SessionService.depositMemo(guest));

        // Trường hợp không có tên thì fallback về mã số
        SessionParticipant noName = SessionParticipant.builder()
                .id(105L)
                .build();

        assertEquals("COC SF105", SessionService.depositMemo(noName));
    }

    @Test
    @DisplayName("finalPaymentMemo: Ghép mã SF và tên không dấu cho tiền sân")
    void testFinalPaymentMemoWithParticipant() {
        User user = User.builder().fullName("Vũ Đình Trọng").build();
        SessionParticipant participant = SessionParticipant.builder()
                .id(77L)
                .user(user)
                .build();

        assertEquals("SF77 VU DINH TRONG", SessionService.finalPaymentMemo(participant));
    }
}
