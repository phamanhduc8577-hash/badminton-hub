package com.smashflow.config;

import com.smashflow.controller.MemberController;
import com.smashflow.controller.SessionController;
import com.smashflow.dto.SessionResponse;
import com.smashflow.model.Role;
import com.smashflow.model.User;
import com.smashflow.security.TokenAuthenticator;
import com.smashflow.service.AvatarOptimizationService;
import com.smashflow.service.CheckinAndPricingService;
import com.smashflow.service.MemberManagementService;
import com.smashflow.service.SessionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Kiểm tra cấu hình SecurityConfig thật: thứ tự matcher QR, 401 JSON, 403 cho member gọi API Host. */
@WebMvcTest(controllers = {SessionController.class, MemberController.class})
@Import(SecurityConfig.class)
class SecurityWiringTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private TokenAuthenticator tokenAuthenticator;
    @MockitoBean private SessionService sessionService;
    @MockitoBean private CheckinAndPricingService checkinAndPricingService;
    @MockitoBean private MemberManagementService memberManagementService;
    @MockitoBean private AvatarOptimizationService avatarOptimizationService;

    private final User member = User.builder().id(2L).phone("0912345678").fullName("Member").role(Role.MEMBER).build();
    private final User host = User.builder().id(1L).phone("0325000001").fullName("Host").role(Role.HOST).build();

    @BeforeEach
    void setUp() {
        when(tokenAuthenticator.resolveFromHeader(any())).thenReturn(Optional.empty());
        when(tokenAuthenticator.resolveFromHeader("Bearer member-token")).thenReturn(Optional.of(member));
        when(tokenAuthenticator.resolveFromHeader("Bearer host-token")).thenReturn(Optional.of(host));
    }

    @Test
    @DisplayName("QR cọc/thanh toán: chưa đăng nhập → 401 JSON (dù GET /api/sessions/** đang public)")
    void qrRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/sessions/participants/12/deposit-qr"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(GlobalExceptionHandler.UNAUTHORIZED_MESSAGE));
        mockMvc.perform(get("/api/sessions/participants/12/payment-qr"))
                .andExpect(status().isUnauthorized());
        // Token bị thu hồi (filter không xác thực) cũng là 401
        mockMvc.perform(get("/api/sessions/participants/12/payment-qr").header("Authorization", "Bearer revoked"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(sessionService);
    }

    @Test
    @DisplayName("QR: chủ lượt → 200; người khác → 403")
    void qrOwnerAndOther() throws Exception {
        when(sessionService.getDepositQrUrl(eq(12L), any())).thenReturn("https://qr.example/ok");
        mockMvc.perform(get("/api/sessions/participants/12/deposit-qr").header("Authorization", "Bearer member-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.qrUrl").value("https://qr.example/ok"));
        verify(sessionService).getDepositQrUrl(12L, member);

        when(sessionService.getFinalPaymentQrUrl(eq(13L), any())).thenThrow(new AccessDeniedException("not owner"));
        mockMvc.perform(get("/api/sessions/participants/13/payment-qr").header("Authorization", "Bearer member-token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(GlobalExceptionHandler.FORBIDDEN_MESSAGE));
    }

    @Test
    @DisplayName("Chi tiết ca vẫn public cho khách chưa đăng nhập")
    void sessionDetailStillPublic() throws Exception {
        when(sessionService.getSessionDetail(eq(77L), any())).thenReturn(SessionResponse.builder().id(77L).build());
        mockMvc.perform(get("/api/sessions/77")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("Member gọi API chỉ dành cho Host → 403 (trước đây 400)")
    void memberCallingHostApiGets403() throws Exception {
        mockMvc.perform(post("/api/members/5/reset-password").header("Authorization", "Bearer member-token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(GlobalExceptionHandler.FORBIDDEN_MESSAGE));
        verify(memberManagementService, never()).resetMemberPassword(any());
    }

    @Test
    @DisplayName("API cần đăng nhập, không gửi token → 401 JSON")
    void protectedEndpointWithoutTokenGets401() throws Exception {
        mockMvc.perform(post("/api/members/5/reset-password"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(GlobalExceptionHandler.UNAUTHORIZED_MESSAGE));
    }

    @Test
    @DisplayName("Dọn DB: tắt → 404 kể cả với Host")
    void resetDbDisabledForHost() throws Exception {
        when(memberManagementService.isDatabaseResetEnabled()).thenReturn(false);
        mockMvc.perform(post("/api/members/reset-database-clean").header("Authorization", "Bearer host-token")
                        .contentType("application/json").content("{\"confirm\":\"XOA TAT CA\"}"))
                .andExpect(status().isNotFound());
        verify(memberManagementService, never()).resetDatabaseClean(anyString());
    }
}
