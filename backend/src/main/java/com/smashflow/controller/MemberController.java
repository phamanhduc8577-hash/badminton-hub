package com.smashflow.controller;

import com.smashflow.dto.MemberProfileResponse;
import com.smashflow.dto.UpdateMembershipRequest;
import com.smashflow.model.MembershipType;
import com.smashflow.service.MemberManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberManagementService memberManagementService;

    @GetMapping
    public ResponseEntity<List<MemberProfileResponse>> getAllMembers(
            @RequestParam(required = false) MembershipType type,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.smashflow.model.User currentUser) {
        if (type != null) {
            return ResponseEntity.ok(memberManagementService.getMembersByType(type, currentUser));
        }
        return ResponseEntity.ok(memberManagementService.getAllMembers(currentUser));
    }

    @PostMapping("/{userId}/approve-fixed")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<MemberProfileResponse> approveFixedMember(@PathVariable Long userId) {
        return ResponseEntity.ok(memberManagementService.approveFixedMember(userId));
    }

    @PostMapping("/{userId}/reject-fixed")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<MemberProfileResponse> rejectFixedMember(@PathVariable Long userId) {
        return ResponseEntity.ok(memberManagementService.rejectFixedMember(userId));
    }

    @PutMapping("/{userId}/membership-type")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<MemberProfileResponse> updateMembershipType(
            @PathVariable Long userId,
            @Valid @RequestBody UpdateMembershipRequest request) {
        return ResponseEntity.ok(memberManagementService.updateMembershipType(userId, request));
    }

    @PutMapping("/{userId}/rank")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<MemberProfileResponse> updateMemberRank(
            @PathVariable Long userId,
            @Valid @RequestBody com.smashflow.dto.UpdateRankRequest request) {
        return ResponseEntity.ok(memberManagementService.updateMemberRank(userId, request));
    }

    @PostMapping("/{userId}/reset-password")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<java.util.Map<String, String>> resetMemberPassword(@PathVariable Long userId) {
        String msg = memberManagementService.resetMemberPassword(userId);
        return ResponseEntity.ok(java.util.Map.of("message", msg));
    }

    @GetMapping("/deleted")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<List<MemberProfileResponse>> getDeletedMembers(
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.smashflow.model.User currentUser) {
        return ResponseEntity.ok(memberManagementService.getDeletedMembers(currentUser));
    }

    @PostMapping("/{userId}/restore")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<MemberProfileResponse> restoreMember(@PathVariable Long userId) {
        return ResponseEntity.ok(memberManagementService.restoreMember(userId));
    }

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<java.util.Map<String, String>> deleteMember(@PathVariable Long userId) {
        String msg = memberManagementService.deleteMember(userId);
        return ResponseEntity.ok(java.util.Map.of("message", msg));
    }

    @PostMapping("/reset-database-clean")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<java.util.Map<String, Object>> resetDatabaseClean() {
        return ResponseEntity.ok(memberManagementService.resetDatabaseClean());
    }
}
