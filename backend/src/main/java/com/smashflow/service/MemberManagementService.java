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

import java.time.LocalDateTime;
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
    private final GenderChangeService genderChangeService;

    public List<MemberProfileResponse> getAllMembers(User currentUser) {
        boolean isHost = currentUser != null && currentUser.getRole() == Role.HOST;
        return userRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .filter(u -> !Boolean.TRUE.equals(u.getDeleted()))
                .map(u -> toResponse(u, isHost))
                .collect(Collectors.toList());
    }

    public List<MemberProfileResponse> getDeletedMembers(User currentUser) {
        boolean isHost = currentUser != null && currentUser.getRole() == Role.HOST;
        return userRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .filter(u -> Boolean.TRUE.equals(u.getDeleted()))
                .filter(u -> !Boolean.TRUE.equals(u.getPurged()))
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

    /**
     * Đổi hạng thành viên chỉ áp cho các lượt CHƯA THANH TOÁN, chưa vắng, ở ca chưa hủy.
     * Lượt đã thu tiền / đã chốt giữ nguyên làm lịch sử đối soát.
     */
    private void syncMemberPricingForActiveSessions(User user, MembershipType newType) {
        boolean isFixed = (newType == MembershipType.FIXED);
        List<com.smashflow.model.SessionParticipant> participations = participantRepository.findByUserId(user.getId());
        for (com.smashflow.model.SessionParticipant p : participations) {
            com.smashflow.model.Session s = p.getSession();
            if (s == null || s.getStatus() == com.smashflow.model.SessionStatus.CANCELLED) continue;
            if (p.getPaymentStatus() != com.smashflow.model.PaymentStatus.UNPAID) continue;
            if (p.getCheckinStatus() == com.smashflow.model.CheckinStatus.ABSENT) continue;

            p.setIsGuest(!isFixed);
            // Cố định được miễn cọc (cọc chưa nhận thì bỏ yêu cầu cọc)
            if (isFixed && p.getDepositStatus() == com.smashflow.model.DepositStatus.PENDING) {
                p.setDepositStatus(com.smashflow.model.DepositStatus.NONE);
                p.setDepositAmount(java.math.BigDecimal.ZERO);
            }

            com.smashflow.model.Gender gender = user.getGender() != null ? user.getGender() : p.getGender();
            PricingCalculator.reprice(p, s, isFixed, gender, p.getDurationHours());
            participantRepository.save(p);
        }
    }

    @Transactional
    public MemberProfileResponse updateMemberGender(Long userId, com.smashflow.model.Gender gender) {
        return toResponse(genderChangeService.changeByHost(userId, gender), true);
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

        if (user.getRole() == Role.HOST) {
            throw new RuntimeException("Không thể đặt lại mật khẩu cho tài khoản Host tại đây!");
        }

        String defaultPass = "123456";
        user.setPassword(passwordEncoder.encode(defaultPass));
        // Host reset mật khẩu → token cũ của thành viên hết hiệu lực
        user.bumpTokenVersion();
        userRepository.save(user);

        try {
            telegramNotificationService.notifyForgotPasswordRequest(user.getFullName(), user.getPhone(), defaultPass, 1, 5);
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
        // Xóa tài khoản → token đang dùng bị thu hồi ngay (khôi phục thì đăng nhập lại)
        user.bumpTokenVersion();
        userRepository.save(user);

        return "Đã xóa tài khoản " + user.getFullName() + ". Bạn có thể khôi phục lại bất kỳ lúc nào!";
    }

    @Transactional
    public MemberProfileResponse restoreMember(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên!"));

        if (Boolean.TRUE.equals(user.getPurged())) {
            throw new RuntimeException("Tài khoản đã bị xóa vĩnh viễn, không thể khôi phục!");
        }

        user.setDeleted(false);
        userRepository.save(user);
        return toResponse(user, true);
    }

    private static final java.security.SecureRandom SECURE_RANDOM = new java.security.SecureRandom();
    private static final String PLACEHOLDER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    public static final String PURGED_AVATAR = "/duck-mascot.png";

    /** Không nằm trong constructor để giữ tương thích các nơi đang khởi tạo service thủ công (test). */
    private com.smashflow.repository.LoyaltyRewardRepository loyaltyRewardRepository;

    @org.springframework.beans.factory.annotation.Autowired
    public void setLoyaltyRewardRepository(com.smashflow.repository.LoyaltyRewardRepository loyaltyRewardRepository) {
        this.loyaltyRewardRepository = loyaltyRewardRepository;
    }

    /**
     * Xóa vĩnh viễn = ẩn danh hóa không hoàn tác. Chỉ áp cho tài khoản đã xóa mềm, không phải Host.
     * Giữ lịch sử tiền (lượt đã thu / ca đã qua) và trận đấu; giải phóng SĐT để đăng ký lại.
     */
    @Transactional
    public String permanentlyDeleteMember(Long userId, String confirmName) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thành viên!"));

        if (user.getRole() == Role.HOST) {
            throw new RuntimeException("Không thể xóa vĩnh viễn tài khoản Host!");
        }
        if (Boolean.TRUE.equals(user.getPurged())) {
            throw new RuntimeException("Tài khoản này đã được xóa vĩnh viễn!");
        }
        if (!Boolean.TRUE.equals(user.getDeleted())) {
            throw new RuntimeException("Vui lòng xóa tài khoản (đưa vào danh sách khôi phục) trước khi xóa vĩnh viễn!");
        }
        String expected = user.getFullName() != null ? user.getFullName().trim() : "";
        if (confirmName == null || !confirmName.trim().equals(expected)) {
            throw new RuntimeException("Tên xác nhận không khớp!");
        }

        String oldName = user.getFullName();
        String anonymizedName = "Thành viên đã xóa #" + user.getId();
        LocalDateTime now = LocalDateTime.now();

        // 1. Lượt đăng ký: chưa thu ở ca chưa diễn ra (không có cọc đã nhận/đã phạt) → xóa trả slot; còn lại giữ tiền, xóa thông tin cá nhân
        for (com.smashflow.model.SessionParticipant p : participantRepository.findByUserId(user.getId())) {
            com.smashflow.model.Session s = p.getSession();
            boolean upcoming = s != null && s.getStartTime() != null && s.getStartTime().isAfter(now);
            boolean depositSettled = p.getDepositStatus() == com.smashflow.model.DepositStatus.PAID
                    || p.getDepositStatus() == com.smashflow.model.DepositStatus.FORFEITED;
            if (upcoming && p.getPaymentStatus() == com.smashflow.model.PaymentStatus.UNPAID && !depositSettled) {
                participantRepository.delete(p);
            } else {
                p.setGuestName(anonymizedName);
                p.setGuestPhone(null);
                participantRepository.save(p);
            }
        }

        // 2. Phần thưởng chưa nhận → xóa; đã trao giữ để đối soát quà
        if (loyaltyRewardRepository != null) {
            List<com.smashflow.model.LoyaltyReward> unclaimed =
                    loyaltyRewardRepository.findByUserIdAndIsClaimedFalseOrderByMilestoneSessionsAsc(user.getId());
            if (!unclaimed.isEmpty()) {
                loyaltyRewardRepository.deleteAll(unclaimed);
            }
        }

        // 3. Ẩn danh hóa tài khoản (giữ chỉ số thi đấu để lịch sử trận của người khác nhất quán)
        user.setFullName(anonymizedName);
        user.setPhone(generatePurgedPhonePlaceholder(user.getId()));
        user.setPassword(null);
        user.setAvatarUrl(PURGED_AVATAR);
        user.setDeleted(true);
        user.setPurged(true);
        user.setDailyPasswordResetCount(0);
        user.bumpTokenVersion();
        userRepository.save(user);

        return "Đã xóa vĩnh viễn tài khoản " + oldName + ". Số điện thoại đã được giải phóng để đăng ký lại.";
    }

    /** SĐT giả không bao giờ trùng SĐT thật (có chữ), độ dài ≤ 20. */
    private String generatePurgedPhonePlaceholder(Long userId) {
        String prefix = "DEL" + userId + "-";
        if (prefix.length() + 6 > 20) {
            prefix = "DEL-";
        }
        String placeholder;
        do {
            StringBuilder sb = new StringBuilder(prefix);
            for (int i = 0; i < 6; i++) {
                sb.append(PLACEHOLDER_ALPHABET.charAt(SECURE_RANDOM.nextInt(PLACEHOLDER_ALPHABET.length())));
            }
            placeholder = sb.toString();
        } while (userRepository.existsByPhone(placeholder));
        return placeholder;
    }

    /** Chuỗi Host phải gửi kèm để xác nhận dọn database. */
    public static final String DB_RESET_CONFIRMATION = "XOA TAT CA";

    /** Chỉ bật khi đặt biến môi trường ALLOW_DB_RESET=true (production không đặt → endpoint trả 404). */
    @org.springframework.beans.factory.annotation.Value("${app.allow-db-reset:false}")
    private boolean allowDbReset;

    public boolean isDatabaseResetEnabled() {
        return allowDbReset;
    }

    @Transactional
    public java.util.Map<String, Object> resetDatabaseClean(String confirmation) {
        if (!allowDbReset) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND);
        }
        if (!DB_RESET_CONFIRMATION.equals(confirmation)) {
            throw new RuntimeException("Vui lòng gửi chuỗi xác nhận \"" + DB_RESET_CONFIRMATION + "\" để dọn database!");
        }

        jdbcTemplate.execute("DELETE FROM matches;");
        jdbcTemplate.execute("DELETE FROM session_participants;");
        jdbcTemplate.execute("DELETE FROM loyalty_rewards;");
        jdbcTemplate.execute("DELETE FROM sessions;");
        jdbcTemplate.execute("DELETE FROM venues;");
        // Chỉ reset chỉ số thi đấu của Host (tìm theo role), không đụng mật khẩu / tên / SĐT
        jdbcTemplate.execute("UPDATE users SET win_count = 0, loss_count = 0, elo_score = 0, sessions_attended = 0, placement_matches = 0, current_streak = 0, shield_matches = 0 WHERE role = 'HOST';");

        return java.util.Map.of("success", true, "message", "Đã dọn sạch ca sân, trận đấu và lịch sử, bảo lưu toàn bộ tài khoản thành viên thật!");
    }

    private MemberProfileResponse toResponse(User u, boolean isHost) {
        int attended = u.getSessionsAttended() != null ? u.getSessionsAttended() : 0;
        if (attended == 0 && ((u.getWinCount() != null && u.getWinCount() > 0) || (u.getLossCount() != null && u.getLossCount() > 0))) {
            attended = 1;
        }
        return MemberProfileResponse.builder()
                .id(u.getId())
                .phone(isHost ? u.getPhone() : null)
                .fullName(u.getFullName())
                .gender(u.getGender())
                .role(u.getRole())
                .membershipType(u.getMembershipType() != null ? u.getMembershipType() : MembershipType.CASUAL)
                .avatarUrl(u.getAvatarUrl() != null ? u.getAvatarUrl() : (u.getRole() == Role.HOST ? "/duck-host-sassy.png" : "/duck-mascot.png"))
                .sessionsAttended(attended)
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
