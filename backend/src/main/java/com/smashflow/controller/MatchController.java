package com.smashflow.controller;

import com.smashflow.dto.CreateMatchRequest;
import com.smashflow.dto.MatchResponse;
import com.smashflow.service.MatchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/matches")
@RequiredArgsConstructor
public class MatchController {

    private final MatchService matchService;

    @GetMapping("/session/{sessionId}")
    public ResponseEntity<List<MatchResponse>> getMatchesBySession(@PathVariable Long sessionId) {
        return ResponseEntity.ok(matchService.getMatchesBySession(sessionId));
    }

    @PostMapping
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<MatchResponse> recordMatchResult(@Valid @RequestBody CreateMatchRequest request) {
        return ResponseEntity.ok(matchService.recordMatchResult(request));
    }
}
