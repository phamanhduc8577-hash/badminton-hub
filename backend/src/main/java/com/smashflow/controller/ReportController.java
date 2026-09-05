package com.smashflow.controller;

import com.smashflow.dto.HostSessionReport;
import com.smashflow.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/session/{sessionId}")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<HostSessionReport> getSessionFinancialReport(@PathVariable Long sessionId) {
        return ResponseEntity.ok(reportService.getSessionFinancialReport(sessionId));
    }
}
