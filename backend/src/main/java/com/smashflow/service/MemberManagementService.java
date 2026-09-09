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
    private final com.smashflow.repository.SessionParticipantRepository participantRepository;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private final TelegramNotificationService telegramNotificationService;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    public List<MemberProfileResponse> getAllMembers(User currentUser) {
        boolean isHost = currentUser != null && currentUser.getRole() == Role.HOST;
        return userRepository.findByDeletedFalseOrderByCreatedAtDesc()
                .stream()
                .map(u -> toResponse(u, isHost))
                .collect(Collectors.toList());
    }

    public List<MemberProfileResponse> getDeletedMembers(User currentUser) {
        boolean isHost = currentUser != null && currentUser.getRole() == Role.HOST;
        return userRepository.findByDeletedTrueOrderByUpdatedAtDesc()
                .stream()
                .map(u -> toResponse(u, isHost))
                .collect(Collectors.toList());
    }

    public List<MemberProfileResponse> getMembersByType(MembershipType type, User currentUser) {
        boolean isHost = currentUser != null && currentUser.getRole() == Role.HOST;
        return userRepository.findByMembershipType(type)
                .stream()
                .filter(u -> !Boolean.TRUE.equals(u.getDeleted()))
                .map(u -> toResponse(u, isHost))
                .collect(Collectors.toList());
    }

    @Transactional
    public MemberProfileResponse approveFixedMember(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên!"));

        user.setMembershipType(MembershipType.FIXED);
        userRepository.save(user);

        // Auto sync active session participations to official FIXED member pricing and status
        syncMemberPricingForActiveSessions(user, MembershipType.FIXED);

        return toResponse(user, true);
    }

    @Transactional
    public MemberProfileResponse rejectFixedMember(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên!"));

        user.setMembershipType(MembershipType.CASUAL);
        userRepository.save(user);

        syncMemberPricingForActiveSessions(user, MembershipType.CASUAL);

        return toResponse(user, true);
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

        syncMemberPricingForActiveSessions(user, request.getMembershipType());

        return toResponse(user, true);
    }

    private void syncMemberPricingForActiveSessions(User user, MembershipType newType) {
        try {
            List<com.smashflow.model.SessionParticipant> participations = participantRepository.findByUserId(user.getId());
            for (com.smashflow.model.SessionParticipant p : participations) {
                com.smashflow.model.Session s = p.getSession();
                if (s == null) continue;

                boolean is2h = p.getDurationHours() != null && p.getDurationHours().compareTo(new java.math.BigDecimal("2.0")) == 0;
                boolean isFixed = (newType == MembershipType.FIXED);

                java.math.BigDecimal newBaseFee;
                if (isFixed) {
                    p.setIsGuest(false);
                    // Cố định được miễn cọc
                    if (p.getDepositStatus() == com.smashflow.model.DepositStatus.PENDING) {
                        p.setDepositStatus(com.smashflow.model.DepositStatus.NONE);
                        p.setDepositAmount(java.math.BigDecimal.ZERO);
                    }
                    if (is2h && s.getMemberMalePrice2h() != null) {
                        newBaseFee = user.getGender() == com.smashflow.model.Gender.FEMALE
                                ? (s.getMemberFemalePrice2h() != null ? s.getMemberFemalePrice2h() : s.getMemberFemalePrice())
                                : (s.getMemberMalePrice2h() != null ? s.getMemberMalePrice2h() : s.getMemberMalePrice());
                    } else {
                        newBaseFee = user.getGender() == com.smashflow.model.Gender.FEMALE
                                ? s.getMemberFemalePrice()
                                : s.getMemberMalePrice();
                    }
                } else {
                    p.setIsGuest(true);
                    if (is2h && s.getGuestMalePrice2h() != null) {
                        newBaseFee = user.getGender() == com.smashflow.model.Gender.FEMALE
                                ? (s.getGuestFemalePrice2h() != null ? s.getGuestFemalePrice2h() : s.getGuestFemalePrice())
                                : (s.getGuestMalePrice2h() != null ? s.getGuestMalePrice2h() : s.getGuestMalePrice());
                    } else {
                        newBaseFee = user.getGender() == com.smashflow.model.Gender.FEMALE
                                ? s.getGuestFemalePrice()
                                : s.getGuestMalePrice();
                    }
                }

                if (newBaseFee != null) {
                    p.setBaseFee(newBaseFee);
                    java.math.BigDecimal adj = p.getAdjustmentAmount() != null ? p.getAdjustmentAmount() : java.math.BigDecimal.ZERO;
                    p.setFinalFee(newBaseFee.add(adj).max(java.math.BigDecimal.ZERO));
                    participantRepository.save(p);
                }
            }
        } catch (Exception ignored) {}
    }

    @Transactional
    public MemberProfileResponse updateMemberRank(Long userId, com.smashflow.dto.UpdateRankRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên!"));

        if (request.getEloScore() != null) {
            user.setEloScore(Math.max(0, request.getEloScore()));
        }
        if (request.getPlacementMatches() != null) {
            user.setPlacementMatches(Math.max(0, Math.min(5, request.getPlacementMatches())));
        } else if (request.getEloScore() != null && request.getEloScore() > 0) {
            // If Host sets rank score directly, mark placement complete (5/5)
            user.setPlacementMatches(5);
        }
        if (request.getShieldMatches() != null) {
            user.setShieldMatches(Math.max(0, request.getShieldMatches()));
        }

        userRepository.save(user);
        return toResponse(user, true);
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

    @Transactional
    public String deleteMember(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên!"));

        if (user.getRole() == Role.HOST) {
            throw new RuntimeException("Không thể xóa tài khoản của Host CLB!");
        }

        user.setDeleted(true);
        userRepository.save(user);

        return "Đã xóa tài khoản " + user.getFullName() + ". Bạn có thể khôi phục lại bất kỳ lúc nào!";
    }

    @Transactional
    public MemberProfileResponse restoreMember(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên!"));

        user.setDeleted(false);
        userRepository.save(user);
        return toResponse(user, true);
    }

    @Transactional
    public java.util.Map<String, Object> resetDatabaseClean() {
        try {
            jdbcTemplate.execute("DELETE FROM matches;");
            jdbcTemplate.execute("DELETE FROM session_participants;");
            jdbcTemplate.execute("DELETE FROM loyalty_rewards;");
            jdbcTemplate.execute("DELETE FROM sessions;");
            jdbcTemplate.execute("DELETE FROM venues;");
            jdbcTemplate.execute("UPDATE users SET win_count = 0, loss_count = 0, elo_score = 0, sessions_attended = 0, placement_matches = 0, current_streak = 0, shield_matches = 0 WHERE phone = '0325872682';");

            userRepository.findByPhone("0325872682").ifPresent(host -> {
                host.setRole(Role.HOST);
                host.setMembershipType(MembershipType.FIXED);
                host.setPassword(passwordEncoder.encode("040304"));
                host.setFullName("Phạm Anh Đức");
                host.setAvatarUrl("/duck-host-sassy.png");
                host.setWinCount(0);
                host.setLossCount(0);
                host.setEloScore(0);
                host.setSessionsAttended(0);
                host.setPlacementMatches(0);
                host.setCurrentStreak(0);
                host.setShieldMatches(0);
                userRepository.save(host);
            });

            return java.util.Map.of("success", true, "message", "Đã dọn sạch ca sân, trận đấu và lịch sử, bảo lưu toàn bộ tài khoản thành viên thật!");
        } catch (Exception e) {
            throw new RuntimeException("Lỗi dọn dẹp database: " + e.getMessage());
        }
    }

    private MemberProfileResponse toResponse(User u, boolean isHost) {
        return MemberProfileResponse.builder()
                .id(u.getId())
                .phone(isHost ? u.getPhone() : null)
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
                .placementMatches(u.getPlacementMatches() != null ? u.getPlacementMatches() : 0)
                .currentStreak(u.getCurrentStreak() != null ? u.getCurrentStreak() : 0)
                .shieldMatches(u.getShieldMatches() != null ? u.getShieldMatches() : 0)
                .createdAt(u.getCreatedAt())
                .build();
    }
}
