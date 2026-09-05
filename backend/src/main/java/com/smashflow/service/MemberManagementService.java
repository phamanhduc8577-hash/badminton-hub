package com.smashflow.service;

import com.smashflow.dto.MemberProfileResponse;
import com.smashflow.dto.UpdateMembershipRequest;
import com.smashflow.model.MembershipType;
import com.smashflow.model.Role;
import com.smashflow.model.User;
import com.smashflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MemberManagementService {

    private final UserRepository userRepository;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private final TelegramNotificationService telegramNotificationService;

    public List<MemberProfileResponse> getAllMembers() {
        return userRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<MemberProfileResponse> getMembersByType(MembershipType type) {
        return userRepository.findByMembershipType(type)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public MemberProfileResponse approveFixedMember(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên!"));

        user.setMembershipType(MembershipType.FIXED);
        userRepository.save(user);
        return toResponse(user);
    }

    @Transactional
    public MemberProfileResponse rejectFixedMember(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên!"));

        user.setMembershipType(MembershipType.CASUAL);
        userRepository.save(user);
        return toResponse(user);
    }

    @Transactional
    public MemberProfileResponse updateMembershipType(Long userId, UpdateMembershipRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên!"));

        if (user.getRole() == Role.HOST) {
            throw new RuntimeException("Không thể sửa phân loại của Host CLB!");
        }

        user.setMembershipType(request.getMembershipType());
        userRepository.save(user);
        return toResponse(user);
    }

    @Transactional
    public String resetMemberPassword(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên!"));

        String defaultPass = "123456";
        user.setPassword(passwordEncoder.encode(defaultPass));
        userRepository.save(user);

        try {
            telegramNotificationService.notifyForgotPasswordRequest(user.getFullName(), user.getPhone(), defaultPass);
        } catch (Exception ignored) {}

        return "Đã đặt lại mật khẩu cho " + user.getFullName() + " về mặc định: " + defaultPass;
    }

    private MemberProfileResponse toResponse(User u) {
        return MemberProfileResponse.builder()
                .id(u.getId())
                .phone(u.getPhone())
                .fullName(u.getFullName())
                .gender(u.getGender())
                .role(u.getRole())
                .membershipType(u.getMembershipType() != null ? u.getMembershipType() : MembershipType.CASUAL)
                .avatarUrl(u.getAvatarUrl() != null ? u.getAvatarUrl() : (u.getRole() == Role.HOST ? "/duck-host-sassy.png" : "/duck-mascot.png"))
                .sessionsAttended(u.getSessionsAttended() != null ? u.getSessionsAttended() : 0)
                .winCount(u.getWinCount() != null ? u.getWinCount() : 0)
                .lossCount(u.getLossCount() != null ? u.getLossCount() : 0)
                .winRate(u.getWinRate())
                .eloScore(u.getEloScore())
                .createdAt(u.getCreatedAt())
                .build();
    }
}
