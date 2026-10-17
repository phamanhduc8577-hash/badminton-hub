package com.smashflow.service;

import com.smashflow.dto.ParticipantResponse;
import com.smashflow.model.Role;
import com.smashflow.model.User;

import java.util.List;

/**
 * Che SĐT ở phía server: người xem không phải Host chỉ thấy đầy đủ SĐT của chính mình,
 * SĐT của người khác được che dạng "0912***678".
 */
public final class PhoneMasking {

    private PhoneMasking() {
    }

    public static boolean isHost(User user) {
        return user != null && user.getRole() == Role.HOST;
    }

    /** "0912345678" → "0912***678". SĐT quá ngắn được che toàn bộ. */
    public static String mask(String phone) {
        if (phone == null || phone.isBlank() || "N/A".equals(phone)) {
            return phone;
        }
        if (phone.length() < 7) {
            return "***";
        }
        return phone.substring(0, 4) + "***" + phone.substring(phone.length() - 3);
    }

    /** Lượt đăng ký có phải của chính người xem không (theo userId hoặc SĐT). */
    public static boolean isSelf(ParticipantResponse p, User viewer) {
        if (viewer == null || p == null) {
            return false;
        }
        boolean sameUser = p.getUserId() != null && viewer.getId() != null && p.getUserId().equals(viewer.getId());
        boolean samePhone = p.getPhone() != null && viewer.getPhone() != null && p.getPhone().equals(viewer.getPhone());
        return sameUser || samePhone;
    }

    /** Host thấy đủ; chính chủ thấy đủ SĐT của mình; còn lại bị che. */
    public static ParticipantResponse maskForViewer(ParticipantResponse p, User viewer) {
        if (p != null && !isHost(viewer) && !isSelf(p, viewer)) {
            p.setPhone(mask(p.getPhone()));
        }
        return p;
    }

    public static List<ParticipantResponse> maskForViewer(List<ParticipantResponse> participants, User viewer) {
        if (participants != null) {
            participants.forEach(p -> maskForViewer(p, viewer));
        }
        return participants;
    }
}
