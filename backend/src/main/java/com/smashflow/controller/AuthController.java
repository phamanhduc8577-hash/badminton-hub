package com.smashflow.controller;

import com.smashflow.dto.AuthResponse;
import com.smashflow.dto.LoginRequest;
import com.smashflow.dto.RegisterRequest;
import com.smashflow.model.User;
import com.smashflow.security.TokenAuthenticator;
import com.smashflow.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final TokenAuthenticator tokenAuthenticator;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<com.smashflow.dto.ForgotPasswordResponse> forgotPassword(@Valid @RequestBody com.smashflow.dto.ForgotPasswordRequest request) {
        return ResponseEntity.ok(authService.requestForgotPassword(request.getPhone()));
    }

    @GetMapping("/me")
    public ResponseEntity<AuthResponse> getCurrentUser(@AuthenticationPrincipal User user,
                                                      @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User current = resolveCurrentUser(user, authHeader);
        if (current == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(authService.getCurrentUser(current));
    }

    @RequestMapping(value = "/profile", method = {RequestMethod.PUT, RequestMethod.POST})
    public ResponseEntity<AuthResponse> updateProfile(@AuthenticationPrincipal User user,
                                                      @RequestBody com.smashflow.dto.UpdateProfileRequest request,
                                                      @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User currentUser = resolveCurrentUser(user, authHeader);
        if (currentUser == null) {
            return ResponseEntity.status(401).body(null);
        }
        return ResponseEntity.ok(authService.updateProfile(currentUser, request));
    }

    /**
     * Ưu tiên principal do JwtAuthenticationFilter đặt; nếu không có thì tự kiểm tra header
     * bằng cùng một bộ kiểm tra (user bị xóa / token_version cũ đều bị từ chối).
     */
    private User resolveCurrentUser(User principal, String authHeader) {
        if (principal != null) {
            return principal;
        }
        return tokenAuthenticator.resolveFromHeader(authHeader).orElse(null);
    }
}
