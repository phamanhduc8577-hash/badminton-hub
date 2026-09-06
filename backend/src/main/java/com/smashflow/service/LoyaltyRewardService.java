package com.smashflow.service;

import com.smashflow.dto.AttendanceHistoryResponse;
import com.smashflow.dto.LoyaltyRewardResponse;
import com.smashflow.model.CheckinStatus;
import com.smashflow.model.LoyaltyReward;
import com.smashflow.model.User;
import com.smashflow.repository.LoyaltyRewardRepository;
import com.smashflow.repository.SessionParticipantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LoyaltyRewardService {

    private final LoyaltyRewardRepository loyaltyRewardRepository;
    private final SessionParticipantRepository sessionParticipantRepository;

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

    @Transactional
    public LoyaltyRewardResponse claimRewardByMilestone(Integer milestone, User user) {
        // Ensure user reached milestone
        int attended = user.getSessionsAttended() != null ? user.getSessionsAttended() : 0;
        if (attended < milestone) {
            throw new RuntimeException("Bạn chưa đạt đủ " + milestone + " buổi tham gia để nhận phần thưởng này!");
        }

        LoyaltyReward reward = loyaltyRewardRepository.findByUserIdAndMilestoneSessions(user.getId(), milestone)
                .orElseGet(() -> {
                    String rName = getRewardNameForMilestone(milestone);
                    return loyaltyRewardRepository.save(LoyaltyReward.builder()
                            .user(user)
                            .milestoneSessions(milestone)
                            .rewardName(rName)
                            .isClaimed(false)
                            .build());
                });

        if (reward.getIsClaimed()) {
            throw new RuntimeException("Phần thưởng mốc " + milestone + " buổi này đã được nhận rồi!");
        }

        reward.setIsClaimed(true);
        reward.setClaimedAt(LocalDateTime.now());
        loyaltyRewardRepository.save(reward);

        return toResponse(reward);
    }

    public static String getRewardNameForMilestone(int milestone) {
        return switch (milestone) {
            case 5 -> "1 chai nước tăng lực Revive";
            case 10 -> "Voucher giảm 15% tiền vé";
            case 20 -> "1 quấn cán vợt cao cấp";
            case 25 -> "2 quấn cán cao su";
            case 30 -> "Voucher giảm 20% giá sân";
            case 35 -> "Voucher giảm 25% giá sân";
            case 40 -> "Voucher giảm 30% giá sân";
            case 45 -> "2 chai nước tăng lực Revive";
            case 50 -> "3 quấn cán cao su";
            case 55 -> "3 chai nước tăng lực Revive";
            case 60 -> "Voucher giảm 30% giá vé";
            case 65 -> "Voucher giảm 35% giá vé";
            case 70 -> "3 chai nước tăng lực Revive";
            case 80 -> "Voucher giảm 38% giá vé";
            case 90 -> "Voucher giảm 40% giá vé";
            case 100 -> "1 đôi vớ Yonex chính hãng";
            default -> "Hộp quà tri ân đặc biệt CLB Làng Địa Ngục";
        };
    }

    @Transactional
    public LoyaltyRewardResponse claimReward(Long rewardId, User user) {
        LoyaltyReward reward = loyaltyRewardRepository.findById(rewardId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phần thưởng!"));

        if (!reward.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Bạn không sở hữu phần thưởng này!");
        }

        if (reward.getIsClaimed()) {
            throw new RuntimeException("Phần thưởng này đã được nhận rồi!");
        }

        reward.setIsClaimed(true);
        reward.setClaimedAt(LocalDateTime.now());
        loyaltyRewardRepository.save(reward);

        return toResponse(reward);
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
