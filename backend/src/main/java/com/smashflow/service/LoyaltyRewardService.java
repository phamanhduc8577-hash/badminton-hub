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
