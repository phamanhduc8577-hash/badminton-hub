package com.smashflow.service;

import com.smashflow.dto.AuthResponse;
import com.smashflow.dto.LoginRequest;
import com.smashflow.dto.UpdateProfileRequest;
import com.smashflow.model.Role;
import com.smashflow.model.User;
import com.smashflow.repository.SessionParticipantRepository;
import com.smashflow.repository.UserRepository;
import com.smashflow.security.JwtProvider;
import com.smashflow.security.LoginAttemptService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthSecurityTest {

    /** Đồng hồ chỉnh tay được để test cửa sổ 15 phút. */
    static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-10-16T10:00:00Z");

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
        void advance(Duration d) { now = now.plus(d); }
    }

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private TelegramNotificationService telegramNotificationService;
    @Mock private GenderChangeService genderChangeService;
    @Mock private SessionParticipantRepository participantRepository;
    @Mock private JdbcTemplate jdbcTemplate;

    private final JwtProvider jwtProvider = new JwtProvider("test-secret-test-secret-test-secret-0123456789", 60_000L);
    private MutableClock clock;
    private AuthService authService;
    private MemberManagementService memberService;
    private User user;

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        authService = new AuthService(userRepository, passwordEncoder, jwtProvider, telegramNotificationService,
                genderChangeService, new LoginAttemptService(clock));
        memberService = new MemberManagementService(userRepository, participantRepository, passwordEncoder,
                telegramNotificationService, jdbcTemplate, genderChangeService);

        user = User.builder().id(9L).phone("0900000009").fullName("Đổi Mật Khẩu").role(Role.MEMBER)
                .password("HASH_OLD").build();
        when(userRepository.findByPhone("0900000009")).thenReturn(Optional.of(user));
        when(userRepository.findById(9L)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(passwordEncoder.encode(anyString())).thenAnswer(i -> "HASH_" + i.getArgument(0));
        when(passwordEncoder.matches("dung-mat-khau", "HASH_OLD")).thenReturn(true);
        when(passwordEncoder.matches("sai-mat-khau", "HASH_OLD")).thenReturn(false);
        when(passwordEncoder.matches("mat-khau-moi", "HASH_OLD")).thenReturn(false);
    }

    private LoginRequest login(String password) {
        LoginRequest r = new LoginRequest();
        r.setPhone("0900000009");
        r.setPassword(password);
        return r;
    }

    // ---------- token_version ----------

    @Test
    @DisplayName("Đổi mật khẩu → tăng token_version và trả token MỚI (claim tv mới) cho phiên hiện tại")
    void passwordChangeBumpsVersionAndReturnsNewToken() {
        UpdateProfileRequest req = new UpdateProfileRequest();
        req.setOldPassword("dung-mat-khau");
        req.setNewPassword("mat-khau-moi");

        AuthResponse res = authService.updateProfile(user, req);

        assertEquals(1, user.getTokenVersion());
        assertNotNull(res.getToken(), "Phải trả token mới để người đang đổi mật khẩu không bị đăng xuất");
        assertEquals(1, JwtProvider.getTokenVersion(jwtProvider.parseClaims(res.getToken()).orElseThrow()));
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("Sửa hồ sơ không đổi mật khẩu → giữ token_version, không trả token")
    void profileEditWithoutPasswordKeepsVersion() {
        UpdateProfileRequest req = new UpdateProfileRequest();
        req.setFullName("Tên Mới");

        AuthResponse res = authService.updateProfile(user, req);

        assertEquals(0, user.getTokenVersion());
        assertNull(res.getToken());
        assertEquals("Tên Mới", user.getFullName());
    }

    @Test
    @DisplayName("Host xóa thành viên → deleted + tăng token_version")
    void deleteMemberBumpsVersion() {
        memberService.deleteMember(9L);
        assertTrue(user.getDeleted());
        assertEquals(1, user.getTokenVersion());
    }

    @Test
    @DisplayName("Host reset mật khẩu → tăng token_version (giữ hành vi reset về 123456)")
    void resetPasswordBumpsVersion() {
        user.setTokenVersion(2);
        String msg = memberService.resetMemberPassword(9L);
        assertEquals(3, user.getTokenVersion());
        assertEquals("HASH_123456", user.getPassword());
        assertTrue(msg.contains("123456"));
    }

    @Test
    @DisplayName("Đăng nhập cấp token mang token_version hiện tại")
    void loginTokenCarriesVersion() {
        user.setTokenVersion(4);
        AuthResponse res = authService.login(login("dung-mat-khau"));
        assertEquals(4, JwtProvider.getTokenVersion(jwtProvider.parseClaims(res.getToken()).orElseThrow()));
    }

    // ---------- khóa đăng nhập theo SĐT ----------

    private void failTimes(int n) {
        for (int i = 0; i < n; i++) {
            RuntimeException ex = assertThrows(RuntimeException.class, () -> authService.login(login("sai-mat-khau")));
            assertEquals("Số điện thoại hoặc mật khẩu không chính xác!", ex.getMessage());
        }
    }

    @Test
    @DisplayName("Sai 10 lần trong 15 phút → khóa, kể cả nhập đúng mật khẩu; hết 15 phút thì đăng nhập lại được")
    void lockoutAfterTenFailures() {
        failTimes(10);

        RuntimeException ex = assertThrows(RuntimeException.class, () -> authService.login(login("dung-mat-khau")));
        assertEquals(AuthService.LOGIN_LOCKED_MESSAGE, ex.getMessage());

        clock.advance(Duration.ofMinutes(14));
        assertThrows(RuntimeException.class, () -> authService.login(login("dung-mat-khau")));

        clock.advance(Duration.ofMinutes(2));
        assertNotNull(authService.login(login("dung-mat-khau")).getToken());
    }

    @Test
    @DisplayName("Đăng nhập thành công reset bộ đếm sai")
    void successResetsCounter() {
        failTimes(9);
        assertNotNull(authService.login(login("dung-mat-khau")).getToken());
        failTimes(9);
        assertNotNull(authService.login(login("dung-mat-khau")).getToken());
    }

    @Test
    @DisplayName("Các lần sai cách nhau quá 15 phút không cộng dồn")
    void failuresOutsideWindowDoNotCount() {
        failTimes(9);
        clock.advance(Duration.ofMinutes(16));
        failTimes(1);
        assertNotNull(authService.login(login("dung-mat-khau")).getToken());
    }

    @Test
    @DisplayName("SĐT chưa đăng ký cũng bị tính lần sai (chống dò)")
    void unknownPhoneCountsAsFailure() {
        when(userRepository.findByPhone("0911111111")).thenReturn(Optional.empty());
        LoginRequest r = new LoginRequest();
        r.setPhone("0911111111");
        r.setPassword("x");
        for (int i = 0; i < 10; i++) {
            assertThrows(RuntimeException.class, () -> authService.login(r));
        }
        RuntimeException ex = assertThrows(RuntimeException.class, () -> authService.login(r));
        assertEquals(AuthService.LOGIN_LOCKED_MESSAGE, ex.getMessage());
    }
}
