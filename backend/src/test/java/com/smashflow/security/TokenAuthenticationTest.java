package com.smashflow.security;

import com.smashflow.controller.AuthController;
import com.smashflow.dto.AuthResponse;
import com.smashflow.model.Role;
import com.smashflow.model.User;
import com.smashflow.repository.UserRepository;
import com.smashflow.service.AuthService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TokenAuthenticationTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-0123456789";

    @Mock private UserRepository userRepository;
    @Mock private AuthService authService;

    private JwtProvider jwtProvider;
    private TokenAuthenticator tokenAuthenticator;
    private JwtAuthenticationFilter filter;
    private User user;

    @BeforeEach
    void setUp() {
        jwtProvider = new JwtProvider(SECRET, 60_000L);
        tokenAuthenticator = new TokenAuthenticator(jwtProvider, userRepository);
        filter = new JwtAuthenticationFilter(tokenAuthenticator);
        user = User.builder().id(5L).phone("0900000005").fullName("Thành Viên").role(Role.MEMBER).build();
        when(userRepository.findByPhone("0900000005")).thenReturn(Optional.of(user));
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private Authentication runFilter(String token) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/sessions");
        request.addHeader("Authorization", "Bearer " + token);
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, new MockHttpServletResponse(), chain);
        assertNotNull(chain.getRequest(), "Filter phải luôn cho request đi tiếp");
        return SecurityContextHolder.getContext().getAuthentication();
    }

    /** Token kiểu cũ (trước khi có claim "tv"). */
    private String legacyTokenWithoutTv(String phone) {
        return Jwts.builder()
                .subject(phone)
                .claim("role", "MEMBER")
                .claim("userId", 5L)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000L))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    @Test
    @DisplayName("Token hợp lệ, đúng token_version → được xác thực, có claim tv")
    void validTokenAuthenticated() throws Exception {
        user.setTokenVersion(3);
        String token = jwtProvider.generateToken(user);
        assertEquals(3, JwtProvider.getTokenVersion(jwtProvider.parseClaims(token).orElseThrow()));

        Authentication auth = runFilter(token);
        assertNotNull(auth);
        assertSame(user, auth.getPrincipal());
        assertTrue(auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_MEMBER")));
    }

    @Test
    @DisplayName("User đã bị xóa (deleted=true) → filter không xác thực")
    void deletedUserRejected() throws Exception {
        String token = jwtProvider.generateToken(user);
        user.setDeleted(true);
        assertNull(runFilter(token));
    }

    @Test
    @DisplayName("token_version trong DB đã tăng → token cũ bị từ chối")
    void tokenVersionMismatchRejected() throws Exception {
        String oldToken = jwtProvider.generateToken(user); // tv = 0
        user.bumpTokenVersion(); // đổi mật khẩu / reset → 1
        assertNull(runFilter(oldToken));

        String newToken = jwtProvider.generateToken(user);
        assertNotNull(runFilter(newToken));
    }

    @Test
    @DisplayName("Token cũ không có claim tv vẫn dùng được khi token_version = 0 (không ai bị đăng xuất khi deploy)")
    void legacyTokenWithoutTvAccepted() throws Exception {
        String legacy = legacyTokenWithoutTv("0900000005");
        assertNotNull(runFilter(legacy));

        user.setTokenVersion(null); // dữ liệu cũ chưa migrate → coi là 0
        assertNotNull(runFilter(legacy));
    }

    @Test
    @DisplayName("Token cũ không có claim tv bị từ chối khi token_version đã > 0")
    void legacyTokenRejectedAfterBump() throws Exception {
        user.setTokenVersion(1);
        assertNull(runFilter(legacyTokenWithoutTv("0900000005")));
    }

    @Test
    @DisplayName("Token rác / sai chữ ký → không xác thực")
    void garbageTokenRejected() throws Exception {
        assertNull(runFilter("not-a-jwt"));
        JwtProvider other = new JwtProvider("another-secret-another-secret-another-secret-xx", 60_000L);
        assertNull(runFilter(other.generateToken(user)));
    }

    @Test
    @DisplayName("Đường fallback /auth/me và /auth/profile dùng cùng kiểm tra deleted + tv")
    void authControllerFallbackAppliesSameChecks() {
        AuthController controller = new AuthController(authService, tokenAuthenticator);
        when(authService.getCurrentUser(any())).thenReturn(AuthResponse.builder().id(5L).build());
        when(authService.updateProfile(any(), any())).thenReturn(AuthResponse.builder().id(5L).build());

        String token = jwtProvider.generateToken(user);
        assertEquals(200, controller.getCurrentUser(null, "Bearer " + token).getStatusCode().value());

        user.bumpTokenVersion();
        assertEquals(401, controller.getCurrentUser(null, "Bearer " + token).getStatusCode().value());
        ResponseEntity<AuthResponse> profile = controller.updateProfile(null, new com.smashflow.dto.UpdateProfileRequest(), "Bearer " + token);
        assertEquals(401, profile.getStatusCode().value());

        user.setTokenVersion(0);
        user.setDeleted(true);
        assertEquals(401, controller.getCurrentUser(null, "Bearer " + token).getStatusCode().value());
        verify(authService, times(1)).getCurrentUser(any());
        verify(authService, never()).updateProfile(any(), any());
    }

    @Test
    @DisplayName("IP client lấy phần tử CUỐI của X-Forwarded-For, không có header thì dùng remoteAddr")
    void clientIpUsesLastForwardedEntry() {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr("10.0.0.1");
        assertEquals("10.0.0.1", RateLimitingFilter.getClientIp(req));

        req.addHeader("X-Forwarded-For", "1.1.1.1, 2.2.2.2 ,  203.0.113.9 ");
        assertEquals("203.0.113.9", RateLimitingFilter.getClientIp(req));

        MockHttpServletRequest single = new MockHttpServletRequest();
        single.addHeader("X-Forwarded-For", "198.51.100.7");
        assertEquals("198.51.100.7", RateLimitingFilter.getClientIp(single));

        MockHttpServletRequest trailingComma = new MockHttpServletRequest();
        trailingComma.addHeader("X-Forwarded-For", "6.6.6.6, 198.51.100.8, ");
        assertEquals("198.51.100.8", RateLimitingFilter.getClientIp(trailingComma));

        MockHttpServletRequest spoofRealIp = new MockHttpServletRequest();
        spoofRealIp.setRemoteAddr("10.0.0.2");
        spoofRealIp.addHeader("X-Real-IP", "6.6.6.6");
        assertEquals("10.0.0.2", RateLimitingFilter.getClientIp(spoofRealIp));

        // Sau Cloudflare (Render): ưu tiên CF-Connecting-IP thay cho IP proxy cuối trong XFF
        MockHttpServletRequest viaCloudflare = new MockHttpServletRequest();
        viaCloudflare.addHeader("X-Forwarded-For", "6.6.6.6, 203.0.113.50, 172.70.1.1");
        viaCloudflare.addHeader("CF-Connecting-IP", "203.0.113.50");
        assertEquals("203.0.113.50", RateLimitingFilter.getClientIp(viaCloudflare));
    }
}
