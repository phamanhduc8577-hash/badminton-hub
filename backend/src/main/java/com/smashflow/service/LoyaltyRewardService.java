package com.smashflow.service;

import com.smashflow.dto.AttendanceHistoryResponse;
import com.smashflow.dto.LoyaltyRewardResponse;
import com.smashflow.dto.PendingHandoverResponse;
import com.smashflow.model.CheckinStatus;
import com.smashflow.model.LoyaltyReward;
import com.smashflow.model.User;
import com.smashflow.repository.LoyaltyRewardRepository;
import com.smashflow.repository.SessionParticipantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LoyaltyRewardService {

    /** Danh sách mốc quà hợp lệ duy nhất của CLB. Mọi chỗ cần mốc đều phải dùng danh sách này. */
    public static final List<Integer> MILESTONES = List.of(5, 10, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100);

    /** Các mốc là voucher giảm giá: tự động trừ khi đăng ký ca, Host không phải trao tận tay. */
    public static final List<Integer> VOUCHER_MILESTONES = List.of(10, 30, 35, 40, 60, 65, 80, 90);

    private final LoyaltyRewardRepository loyaltyRewardRepository;
    private final SessionParticipantRepository sessionParticipantRepository;

    public static boolean isValidMilestone(Integer milestone) {
        return milestone != null && MILESTONES.contains(milestone);
    }

    public static boolean isVoucherMilestone(Integer milestone) {
        return milestone != null && getVoucherDiscountPercent(milestone) != null;
    }

    public List<LoyaltyRewardResponse> getUserRewards(User user) {
        return loyaltyRewardRepository.findByUserIdOrderByMilestoneSessionsAsc(user.getId()).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<AttendanceHistoryResponse> getUserAttendanceHistory(User user) {
        return sessionParticipantRepository.findByUserIdAndCheckinStatusOrderByCheckinAtDesc(user.getId(), CheckinStatus.CHECKED_IN).stream()
                .map(sp -> AttendanceHistoryResponse.builder()
                        .sessionId(sp.getSession().getId())
                        .sessionTitle(sp.getSession().getTitle())
                        .venueName(sp.getSession().getVenue().getName())
                        .checkinAt(sp.getCheckinAt())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * Tạo các phần quà (chưa nhận) cho mọi mốc hợp lệ mà thành viên đã đạt mà chưa có bản ghi.
     * Chỉ được gọi bên trong transaction đã khóa dòng user để không tạo trùng.
     */
    @Transactional
    public void grantEligibleRewards(User user, int attended) {
        Set<Integer> existing = new HashSet<>();
        for (LoyaltyReward r : loyaltyRewardRepository.findByUserIdOrderByMilestoneSessionsAsc(user.getId())) {
            existing.add(r.getMilestoneSessions());
        }
        for (Integer m : MILESTONES) {
            if (attended >= m && !existing.contains(m)) {
                loyaltyRewardRepository.save(LoyaltyReward.builder()
                        .user(user)
                        .milestoneSessions(m)
                        .rewardName(getRewardNameForMilestone(m))
                        .isClaimed(false)
                        .build());
            }
        }
    }

    /**
     * Sau khi hủy điểm danh: xóa các phần quà chưa trao/chưa dùng mà thành viên không còn đủ buổi.
     * Phần quà đã trao hoặc voucher đã dùng được giữ nguyên và trả về dưới dạng lưu ý cho Host.
     */
    @Transactional
    public List<String> revokeIneligibleRewards(User user, int attended) {
        List<String> notes = new ArrayList<>();
        for (LoyaltyReward r : loyaltyRewardRepository.findByUserIdOrderByMilestoneSessionsAsc(user.getId())) {
            if (r.getMilestoneSessions() <= attended) {
                continue;
            }
            if (Boolean.TRUE.equals(r.getIsClaimed())) {
                String action = isVoucherMilestone(r.getMilestoneSessions()) ? "đã được dùng" : "đã được trao";
                notes.add("Quà mốc " + r.getMilestoneSessions() + " buổi (" + r.getRewardName() + ") " + action
                        + " trước đó nên hệ thống giữ nguyên, thành viên hiện còn " + attended + " buổi.");
            } else {
                loyaltyRewardRepository.delete(r);
                notes.add("Đã thu hồi quà mốc " + r.getMilestoneSessions() + " buổi (" + r.getRewardName() + ") vì chưa trao và không còn đủ số buổi.");
            }
        }
        return notes;
    }

    /** Danh sách quà vật lý đã đủ điều kiện nhưng Host chưa trao. */
    public List<PendingHandoverResponse> getPendingHandovers() {
        return loyaltyRewardRepository.findPendingPhysicalRewards(VOUCHER_MILESTONES).stream()
                .filter(r -> !Boolean.TRUE.equals(r.getUser().getDeleted()))
                .map(r -> PendingHandoverResponse.builder()
                        .rewardId(r.getId())
                        .userId(r.getUser().getId())
                        .fullName(r.getUser().getFullName())
                        .phone(r.getUser().getPhone())
                        .avatarUrl(r.getUser().getAvatarUrl())
                        .milestoneSessions(r.getMilestoneSessions())
                        .rewardName(r.getRewardName())
                        .sessionsAttended(r.getUser().getSessionsAttended() != null ? r.getUser().getSessionsAttended() : 0)
                        .createdAt(r.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    /** Host xác nhận đã trao quà vật lý tận tay cho thành viên. */
    @Transactional
    public LoyaltyRewardResponse confirmHandover(Long rewardId) {
        LoyaltyReward reward = loyaltyRewardRepository.findByIdForUpdate(rewardId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phần thưởng!"));

        if (isVoucherMilestone(reward.getMilestoneSessions())) {
            throw new RuntimeException("Voucher được tự động trừ khi thành viên đăng ký ca, không cần trao tận tay!");
        }
        if (Boolean.TRUE.equals(reward.getIsClaimed())) {
            throw new RuntimeException("Phần thưởng này đã được trao rồi!");
        }

        reward.setIsClaimed(true);
        reward.setClaimedAt(LocalDateTime.now());
        loyaltyRewardRepository.save(reward);

        return toResponse(reward);
    }

    public static String getRewardNameForMilestone(int milestone) {
        return switch (milestone) {
            case 5 -> "1 chai nước tăng lực Revive";
            case 10 -> "Voucher giảm 15% tiền slot";
            case 20 -> "1 quấn cán vợt cao cấp";
            case 25 -> "2 quấn cán cao su";
            case 30 -> "Voucher giảm 20% giá sân";
            case 35 -> "Voucher giảm 25% giá sân";
            case 40 -> "Voucher giảm 30% giá sân";
            case 45 -> "2 chai nước tăng lực Revive";
            case 50 -> "3 quấn cán cao su";
            case 55 -> "3 chai nước tăng lực Revive";
            case 60 -> "Voucher giảm 30% giá slot";
            case 65 -> "Voucher giảm 35% giá slot";
            case 70 -> "3 chai nước tăng lực Revive";
            case 80 -> "Voucher giảm 38% giá slot";
            case 90 -> "Voucher giảm 40% giá slot";
            case 100 -> "1 đôi vớ Yonex chính hãng";
            default -> "Hộp quà tri ân đặc biệt CLB Làng Địa Ngục";
        };
    }

    public static Integer getVoucherDiscountPercent(int milestone) {
        return switch (milestone) {
            case 10 -> 15;
            case 30 -> 20;
            case 35 -> 25;
            case 40 -> 30;
            case 60 -> 30;
            case 65 -> 35;
            case 80 -> 38;
            case 90 -> 40;
            default -> null;
        };
    }

    private LoyaltyRewardResponse toResponse(LoyaltyReward r) {
        return LoyaltyRewardResponse.builder()
                .id(r.getId())
                .milestoneSessions(r.getMilestoneSessions())
                .rewardName(r.getRewardName())
                .isClaimed(r.getIsClaimed())
                .claimedAt(r.getClaimedAt() != null ? r.getClaimedAt().toString() : null)
                .build();
    }
}
