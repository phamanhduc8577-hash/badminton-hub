package com.smashflow.controller;

import com.smashflow.dto.AttendanceHistoryResponse;
import com.smashflow.dto.LoyaltyRewardResponse;
import com.smashflow.model.User;
import com.smashflow.service.LoyaltyRewardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/loyalty")
@RequiredArgsConstructor
public class LoyaltyRewardController {

    private final LoyaltyRewardService loyaltyRewardService;

    @GetMapping("/my-rewards")
    public ResponseEntity<List<LoyaltyRewardResponse>> getMyRewards(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(loyaltyRewardService.getUserRewards(user));
    }

    @GetMapping("/attendance-history")
    public ResponseEntity<List<AttendanceHistoryResponse>> getAttendanceHistory(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(loyaltyRewardService.getUserAttendanceHistory(user));
    }

    @PostMapping("/{rewardId}/claim")
    public ResponseEntity<LoyaltyRewardResponse> claimReward(@PathVariable Long rewardId,
                                                             @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(loyaltyRewardService.claimReward(rewardId, user));
    }

    @PostMapping("/milestone/{milestone}/claim")
    public ResponseEntity<LoyaltyRewardResponse> claimRewardByMilestone(@PathVariable Integer milestone,
                                                                        @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(loyaltyRewardService.claimRewardByMilestone(milestone, user));
    }
}
