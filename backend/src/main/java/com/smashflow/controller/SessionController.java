package com.smashflow.controller;

import com.smashflow.dto.*;
import com.smashflow.model.User;
import com.smashflow.service.CheckinAndPricingService;
import com.smashflow.service.SessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;
    private final CheckinAndPricingService checkinAndPricingService;

    @GetMapping
    public ResponseEntity<List<SessionResponse>> getAllSessions() {
        return ResponseEntity.ok(sessionService.getAllSessions());
    }

    @GetMapping("/public/upcoming")
    public ResponseEntity<List<SessionResponse>> getUpcomingSessions() {
        return ResponseEntity.ok(sessionService.getUpcomingSessions());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SessionResponse> getSessionDetail(@PathVariable Long id) {
        return ResponseEntity.ok(sessionService.getSessionDetail(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<SessionResponse> createSession(@AuthenticationPrincipal User host,
                                                         @Valid @RequestBody CreateSessionRequest request) {
        return ResponseEntity.ok(sessionService.createSession(host, request));
    }

    @PostMapping("/public/{sessionId}/book")
    public ResponseEntity<ParticipantResponse> bookPublicSlot(@PathVariable Long sessionId,
                                                              @Valid @RequestBody PublicBookingRequest request) {
        return ResponseEntity.ok(sessionService.bookPublicSlot(sessionId, request));
    }

    @PostMapping("/{sessionId}/join")
    public ResponseEntity<ParticipantResponse> joinSession(@PathVariable Long sessionId,
                                                           @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(sessionService.memberJoinSession(sessionId, user));
    }

    @GetMapping("/participants/{participantId}/deposit-qr")
    public ResponseEntity<Map<String, String>> getDepositQr(@PathVariable Long participantId) {
        String qrUrl = sessionService.getDepositQrUrl(participantId);
        return ResponseEntity.ok(Collections.singletonMap("qrUrl", qrUrl));
    }

    @GetMapping("/participants/{participantId}/payment-qr")
    public ResponseEntity<Map<String, String>> getPaymentQr(@PathVariable Long participantId) {
        String qrUrl = sessionService.getFinalPaymentQrUrl(participantId);
        return ResponseEntity.ok(Collections.singletonMap("qrUrl", qrUrl));
    }

    @PostMapping("/participants/{participantId}/confirm-deposit")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<ParticipantResponse> confirmDeposit(@PathVariable Long participantId) {
        return ResponseEntity.ok(sessionService.confirmDeposit(participantId));
    }

    @PostMapping("/{sessionId}/checkin")
    public ResponseEntity<ParticipantResponse> memberCheckin(@PathVariable Long sessionId,
                                                             @AuthenticationPrincipal User user,
                                                             @Valid @RequestBody CheckinRequest request) {
        return ResponseEntity.ok(checkinAndPricingService.memberCheckin(sessionId, user, request));
    }

    @PostMapping("/participants/{participantId}/manual-checkin")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<ParticipantResponse> hostManualCheckin(@PathVariable Long participantId) {
        return ResponseEntity.ok(checkinAndPricingService.hostCheckinManual(participantId));
    }

    @PostMapping("/participants/override-bill")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<ParticipantResponse> hostOverrideBill(@Valid @RequestBody HostOverrideRequest request) {
        return ResponseEntity.ok(checkinAndPricingService.hostOverrideBill(request));
    }

    @PostMapping("/participants/settle")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<ParticipantResponse> settlePayment(@Valid @RequestBody SettlePaymentRequest request) {
        return ResponseEntity.ok(checkinAndPricingService.settlePayment(request));
    }

    @PostMapping("/participants/{participantId}/select-payment-method")
    public ResponseEntity<ParticipantResponse> selectPaymentMethod(
            @PathVariable Long participantId,
            @AuthenticationPrincipal User user,
            @Valid @RequestBody com.smashflow.dto.SelectPaymentMethodRequest request) {
        return ResponseEntity.ok(checkinAndPricingService.selectPaymentMethod(participantId, user, request.getPaymentMethod()));
    }

    @PutMapping("/{sessionId}")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<SessionResponse> updateSession(@PathVariable Long sessionId,
                                                         @Valid @RequestBody UpdateSessionRequest request) {
        return ResponseEntity.ok(sessionService.updateSession(sessionId, request));
    }

    @PutMapping("/{sessionId}/courts")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<SessionResponse> updateCourts(@PathVariable Long sessionId,
                                                        @Valid @RequestBody UpdateSessionCourtsRequest request) {
        return ResponseEntity.ok(sessionService.updateCourts(sessionId, request));
    }

    @DeleteMapping("/participants/{participantId}")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<Map<String, Object>> removeParticipant(
            @PathVariable Long participantId,
            @RequestParam(defaultValue = "false") boolean forfeitDeposit) {
        sessionService.removeParticipant(participantId, forfeitDeposit);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", forfeitDeposit
                        ? "Đã hủy slot và giữ lại tiền cọc vào doanh thu ca!"
                        : "Đã hủy đăng ký và hoàn trả slot thành công!"
        ));
    }

    @PostMapping("/{sessionId}/auto-seed-matches")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<Map<String, Object>> autoSeedSimulation(@PathVariable Long sessionId) {
        return ResponseEntity.ok(sessionService.autoSeedFullSimulation(sessionId));
    }
}
