package com.smashflow.controller;

import com.smashflow.dto.LeaderboardPageResponse;
import com.smashflow.model.User;
import com.smashflow.service.LeaderboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/leaderboards")
@RequiredArgsConstructor
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    @GetMapping("/attendance")
    public ResponseEntity<LeaderboardPageResponse> getAttendanceLeaderboard(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + LeaderboardService.DEFAULT_PAGE_SIZE) int size,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(leaderboardService.getAttendanceLeaderboard(page, size, currentUser));
    }

    @GetMapping("/wins")
    public ResponseEntity<LeaderboardPageResponse> getWinLeaderboard(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + LeaderboardService.DEFAULT_PAGE_SIZE) int size,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(leaderboardService.getWinRateLeaderboard(page, size, currentUser));
    }
}
