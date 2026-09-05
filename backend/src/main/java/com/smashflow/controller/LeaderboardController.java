package com.smashflow.controller;

import com.smashflow.dto.LeaderboardEntry;
import com.smashflow.service.LeaderboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/leaderboards")
@RequiredArgsConstructor
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    @GetMapping("/attendance")
    public ResponseEntity<List<LeaderboardEntry>> getAttendanceLeaderboard() {
        return ResponseEntity.ok(leaderboardService.getAttendanceLeaderboard());
    }

    @GetMapping("/wins")
    public ResponseEntity<List<LeaderboardEntry>> getWinLeaderboard() {
        return ResponseEntity.ok(leaderboardService.getWinRateLeaderboard());
    }
}
