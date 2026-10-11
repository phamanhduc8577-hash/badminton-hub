package com.smashflow.controller;

import com.smashflow.dto.AttendanceHistoryResponse;
import com.smashflow.dto.LoyaltyRewardResponse;
import com.smashflow.dto.PendingHandoverResponse;
import com.smashflow.model.User;
import com.smashflow.service.LoyaltyRewardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    /** Host xem danh sách quà vật lý đã đủ điều kiện nhưng chưa trao. */
    @GetMapping("/pending-handovers")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<List<PendingHandoverResponse>> getPendingHandovers() {
        return ResponseEntity.ok(loyaltyRewardService.getPendingHandovers());
    }

    /** Host xác nhận đã trao quà tận tay. Member không còn tự nhận quà. */
    @PostMapping("/{rewardId}/handover")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<LoyaltyRewardResponse> confirmHandover(@PathVariable Long rewardId) {
        return ResponseEntity.ok(loyaltyRewardService.confirmHandover(rewardId));
    }
}
