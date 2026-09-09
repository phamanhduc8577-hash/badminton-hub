package com.smashflow.service;

import com.smashflow.dto.AuthResponse;
import com.smashflow.dto.LoginRequest;
import com.smashflow.dto.RegisterRequest;
import com.smashflow.model.Role;
import com.smashflow.model.User;
import com.smashflow.repository.UserRepository;
import com.smashflow.security.JwtProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@lombok.Getter
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;
    private final TelegramNotificationService telegramNotificationService;

    @Transactional
    public String requestForgotPassword(String rawPhone) {
        String cleanPhone = rawPhone != null ? rawPhone.trim() : "";
        User user = userRepository.findByPhone(cleanPhone)
                .orElseThrow(() -> new RuntimeException("Số điện thoại này chưa được đăng ký trong hệ thống SmashFlow!"));

        // Generate temporary default password
        String defaultTempPassword = "smash" + (1000 + (int)(Math.random() * 9000));
        user.setPassword(passwordEncoder.encode(defaultTempPassword));
        userRepository.save(user);

        // Notify Host via Telegram
        try {
            telegramNotificationService.notifyForgotPasswordRequest(user.getFullName(), user.getPhone(), defaultTempPassword);
        } catch (Exception ignored) {}

        return "Yêu cầu khôi phục mật khẩu đã được gửi đến Host qua Telegram! Vui lòng liên hệ Host hoặc kiểm tra tin nhắn với Host để nhận mật khẩu tạm thời.";
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new RuntimeException("Số điện thoại này đã được đăng ký!");
        }

        com.smashflow.model.MembershipType mType = request.getRequestedMembershipType() == com.smashflow.model.MembershipType.FIXED
                ? com.smashflow.model.MembershipType.PENDING_FIXED
                : com.smashflow.model.MembershipType.CASUAL;

        User user = User.builder()
                .phone(request.getPhone())
                .fullName(request.getFullName())
                .password(passwordEncoder.encode(request.getPassword()))
                .gender(request.getGender())
                .role(Role.MEMBER)
                .membershipType(mType)
                .avatarUrl(request.getAvatarUrl() != null && !request.getAvatarUrl().isBlank() ? request.getAvatarUrl() : "/duck-mascot.png")
                .winCount(0)
                .lossCount(0)
                .sessionsAttended(0)
                .build();

        userRepository.save(user);

        // Notify Host on Telegram whenever a new user registers or requests FIXED membership
        try {
            telegramNotificationService.notifyNewUserRegistered(
                    user.getFullName(),
                    user.getPhone(),
                    user.getGender() != null ? user.getGender().name() : "MALE",
                    mType != null ? mType.name() : "CASUAL"
            );
        } catch (Exception ignored) {}

        String token = jwtProvider.generateToken(user.getPhone(), user.getRole().name(), user.getId());

        return toAuthResponse(user, token);
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new RuntimeException("Số điện thoại hoặc mật khẩu không chính xác!"));

        if (Boolean.TRUE.equals(user.getDeleted())) {
            throw new RuntimeException("Tài khoản này đã bị xóa hoặc tạm khóa. Vui lòng liên hệ Host để được khôi phục!");
        }

        if (user.getPassword() == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Số điện thoại hoặc mật khẩu không chính xác!");
        }

        String token = jwtProvider.generateToken(user.getPhone(), user.getRole().name(), user.getId());

        return toAuthResponse(user, token);
    }

    public AuthResponse getCurrentUser(User user) {
        return toAuthResponse(user, null);
    }

    @Transactional
    public AuthResponse updateProfile(User user, com.smashflow.dto.UpdateProfileRequest request) {
        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName().trim());
        }
        if (request.getAvatarUrl() != null && !request.getAvatarUrl().isBlank()) {
            user.setAvatarUrl(request.getAvatarUrl());
        }

        // Logic đổi mật khẩu nếu user nhập mật khẩu mới
        if (request.getNewPassword() != null && !request.getNewPassword().isBlank()) {
            if (request.getNewPassword().trim().length() < 6) {
                throw new RuntimeException("Mật khẩu mới phải có ít nhất 6 ký tự!");
            }
            if (request.getOldPassword() == null || request.getOldPassword().isBlank()) {
                throw new RuntimeException("Vui lòng nhập mật khẩu hiện tại để xác nhận đổi mật khẩu!");
            }
            if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
                throw new RuntimeException("Mật khẩu hiện tại không chính xác!");
            }
            if (passwordEncoder.matches(request.getNewPassword().trim(), user.getPassword())) {
                throw new RuntimeException("Mật khẩu mới không được trùng với mật khẩu hiện tại!");
            }
            user.setPassword(passwordEncoder.encode(request.getNewPassword().trim()));
        }

        userRepository.save(user);
        return toAuthResponse(user, null);
    }

    private AuthResponse toAuthResponse(User user, String token) {
        return AuthResponse.builder()
                .token(token)
                .id(user.getId())
                .phone(user.getPhone())
                .fullName(user.getFullName())
                .gender(user.getGender())
                .role(user.getRole())
                .membershipType(user.getMembershipType())
                .avatarUrl(user.getAvatarUrl() != null ? user.getAvatarUrl() : (user.getRole() == Role.HOST ? "/duck-host-sassy.png" : "/duck-mascot.png"))
                .sessionsAttended(user.getSessionsAttended())
                .winCount(user.getWinCount())
                .lossCount(user.getLossCount())
                .winRate(user.getWinRate())
                .eloScore(user.getEloScore())
                .placementMatches(user.getPlacementMatches() != null ? user.getPlacementMatches() : 0)
                .currentStreak(user.getCurrentStreak() != null ? user.getCurrentStreak() : 0)
                .shieldMatches(user.getShieldMatches() != null ? user.getShieldMatches() : 0)
                .build();
    }
}
