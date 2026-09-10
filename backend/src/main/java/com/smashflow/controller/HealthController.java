package com.smashflow.controller;

import com.smashflow.service.TelegramNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class HealthController {

    private final TelegramNotificationService telegramNotificationService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> checkHealth() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "SmashFlow Backend",
                "version", "2026.09.10-utf8-httpclient"
        ));
    }

    @GetMapping("/test-telegram")
    public ResponseEntity<Map<String, Object>> testTelegram(@RequestParam(defaultValue = "Test từ SmashFlow Live Server") String msg) {
        telegramNotificationService.sendNotification("🚀 <b>[SmashFlow Live Test]</b>\n" + msg);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Đã gửi test telegram thành công!"
        ));
    }
}
