package com.smashflow.controller;

import com.smashflow.dto.AuthResponse;
import com.smashflow.dto.LoginRequest;
import com.smashflow.dto.RegisterRequest;
import com.smashflow.model.User;
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

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<java.util.Map<String, String>> forgotPassword(@Valid @RequestBody com.smashflow.dto.ForgotPasswordRequest request) {
        String message = authService.requestForgotPassword(request.getPhone());
        return ResponseEntity.ok(java.util.Map.of("message", message));
    }

    @GetMapping("/me")
    public ResponseEntity<AuthResponse> getCurrentUser(@AuthenticationPrincipal User user,
                                                      @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (user != null) {
            return ResponseEntity.ok(authService.getCurrentUser(user));
        }
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (authService.getJwtProvider().validateToken(token)) {
                String phone = authService.getJwtProvider().getPhoneFromToken(token);
                User u = authService.getUserRepository().findByPhone(phone).orElse(null);
                if (u != null) {
                    return ResponseEntity.ok(authService.getCurrentUser(u));
                }
            }
        }
        return ResponseEntity.status(401).build();
    }

    @RequestMapping(value = "/profile", method = {RequestMethod.PUT, RequestMethod.POST})
    public ResponseEntity<AuthResponse> updateProfile(@RequestBody com.smashflow.dto.UpdateProfileRequest request,
                                                      @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User currentUser = null;

        // 1. Check SecurityContext principal
        Object principal = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() != null
                ? org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal()
                : null;

        if (principal instanceof User) {
            currentUser = (User) principal;
        }

        // 2. Fallback check Authorization header directly
        if (currentUser == null && authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (authService.getJwtProvider().validateToken(token)) {
                String phone = authService.getJwtProvider().getPhoneFromToken(token);
                currentUser = authService.getUserRepository().findByPhone(phone).orElse(null);
            }
        }

        if (currentUser == null) {
            return ResponseEntity.status(401).body(null);
        }
        return ResponseEntity.ok(authService.updateProfile(currentUser, request));
    }
}
