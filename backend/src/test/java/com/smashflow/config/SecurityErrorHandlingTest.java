package com.smashflow.config;

import com.smashflow.controller.MemberController;
import com.smashflow.model.Role;
import com.smashflow.model.User;
import com.smashflow.repository.SessionParticipantRepository;
import com.smashflow.repository.UserRepository;
import com.smashflow.service.AvatarOptimizationService;
import com.smashflow.service.GenderChangeService;
import com.smashflow.service.MemberManagementService;
import com.smashflow.service.TelegramNotificationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SecurityErrorHandlingTest {

    @Mock private UserRepository userRepository;
    @Mock private SessionParticipantRepository participantRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private TelegramNotificationService telegramNotificationService;
    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private GenderChangeService genderChangeService;
    @Mock private AvatarOptimizationService avatarOptimizationService;

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private MemberManagementService memberService;
    private MemberController controller;

    @BeforeEach
    void setUp() {
        memberService = new MemberManagementService(userRepository, participantRepository, passwordEncoder,
                telegramNotificationService, jdbcTemplate, genderChangeService);
        controller = new MemberController(memberService, avatarOptimizationService);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void loginAs(Role role) {
        User u = User.builder().id(1L).phone("0900000001").fullName("X").role(role).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))));
    }

    // ---------- 1.1 Dọn database ----------

    @Test
    @DisplayName("ALLOW_DB_RESET không bật → 404, không chạy câu lệnh nào")
    void resetDbDisabledReturns404() {
        ResponseEntity<Map<String, Object>> res = controller.resetDatabaseClean(Map.of("confirm", "XOA TAT CA"));
        assertEquals(404, res.getStatusCode().value());
        // Gọi thẳng service cũng bị chặn
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> memberService.resetDatabaseClean("XOA TAT CA"));
        assertEquals(404, ex.getStatusCode().value());
        assertEquals(404, handler.handleRuntimeException(ex).getStatusCode().value());
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    @DisplayName("Bật ALLOW_DB_RESET nhưng thiếu/sai chuỗi xác nhận → 400")
    void resetDbWithoutConfirmReturns400() {
        ReflectionTestUtils.setField(memberService, "allowDbReset", true);

        RuntimeException noBody = assertThrows(RuntimeException.class, () -> controller.resetDatabaseClean(null));
        RuntimeException wrong = assertThrows(RuntimeException.class, () -> controller.resetDatabaseClean(Map.of("confirm", "xoa tat ca")));

        assertEquals(400, handler.handleRuntimeException(noBody).getStatusCode().value());
        assertTrue(handler.handleRuntimeException(wrong).getBody().get("message").contains("XOA TAT CA"));
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    @DisplayName("Bật + đúng xác nhận → dọn dữ liệu, chỉ reset chỉ số Host theo role, không đổi mật khẩu Host")
    void resetDbWithConfirmRuns() {
        ReflectionTestUtils.setField(memberService, "allowDbReset", true);

        ResponseEntity<Map<String, Object>> res = controller.resetDatabaseClean(Map.of("confirm", "XOA TAT CA"));

        assertEquals(200, res.getStatusCode().value());
        verify(jdbcTemplate).execute("DELETE FROM matches;");
        verify(jdbcTemplate).execute(argThatContains("WHERE role = 'HOST'"));
        verify(jdbcTemplate, never()).execute(argThatContains("0325872682"));
        verify(passwordEncoder, never()).encode(anyString());
        verify(userRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    private static String argThatContains(String s) {
        return org.mockito.ArgumentMatchers.argThat(sql -> sql != null && sql.contains(s));
    }

    // ---------- 1.7 Mã lỗi ----------

    @Test
    @DisplayName("AccessDenied / AuthorizationDenied (member gọi API Host) → 403 với thông báo chung")
    void accessDeniedMapsTo403() {
        loginAs(Role.MEMBER);
        ResponseEntity<Map<String, String>> res = handler.handleAccessDenied(new AccessDeniedException("internal detail"));
        assertEquals(HttpStatus.FORBIDDEN, res.getStatusCode());
        assertEquals("Bạn không có quyền thực hiện thao tác này!", res.getBody().get("message"));

        ResponseEntity<Map<String, String>> res2 = handler.handleAccessDenied(
                new AuthorizationDeniedException("Access Denied", () -> false));
        assertEquals(HttpStatus.FORBIDDEN, res2.getStatusCode());
    }

    @Test
    @DisplayName("AccessDenied khi chưa đăng nhập → 401")
    void accessDeniedAnonymousMapsTo401() {
        ResponseEntity<Map<String, String>> res = handler.handleAccessDenied(new AccessDeniedException("x"));
        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
    }

    @Test
    @DisplayName("NPE / lỗi DB / IllegalState → 500 thông báo chung, không lộ chi tiết")
    void unexpectedErrorsMapTo500Generic() {
        for (RuntimeException ex : List.<RuntimeException>of(
                new NullPointerException("Cannot invoke \"com.smashflow.model.User.getId()\""),
                new DataIntegrityViolationException("duplicate key value violates unique constraint users_phone_key"),
                new IllegalStateException("framework internal"))) {
            ResponseEntity<Map<String, String>> res = handler.handleRuntimeException(ex);
            assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, res.getStatusCode());
            assertEquals("Đã xảy ra lỗi hệ thống, vui lòng thử lại!", res.getBody().get("message"));
        }
        ResponseEntity<Map<String, String>> checked = handler.handleGenericException(new Exception("secret detail"));
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, checked.getStatusCode());
        assertEquals("Đã xảy ra lỗi hệ thống, vui lòng thử lại!", checked.getBody().get("message"));
    }

    @Test
    @DisplayName("Lỗi nghiệp vụ RuntimeException tiếng Việt vẫn 400 kèm thông báo")
    void businessErrorStays400() {
        ResponseEntity<Map<String, String>> res = handler.handleRuntimeException(new RuntimeException("Ca đánh này đã đủ quân số!"));
        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
        assertEquals("Ca đánh này đã đủ quân số!", res.getBody().get("message"));
    }
}
