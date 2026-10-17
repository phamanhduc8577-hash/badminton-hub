package com.smashflow.service;

import com.smashflow.dto.CreateSessionRequest;
import com.smashflow.dto.ParticipantResponse;
import com.smashflow.dto.PublicBookingRequest;
import com.smashflow.dto.SessionResponse;
import com.smashflow.dto.UpdateSessionCourtsRequest;
import com.smashflow.dto.UpdateSessionRequest;
import com.smashflow.model.*;
import com.smashflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SessionService {

    private final SessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final VenueRepository venueRepository;
    private final UserRepository userRepository;
    private final VietQrService vietQrService;
    private final TelegramNotificationService telegramNotificationService;
    private final LoyaltyRewardRepository loyaltyRewardRepository;

    public List<SessionResponse> getAllSessions(User currentUser) {
        List<Long> bookedSessionIds = (currentUser != null)
                ? participantRepository.findBookedSessionIdsByUserIdOrPhone(currentUser.getId(), currentUser.getPhone())
                : List.of();

        return sessionRepository.findAllByOrderByStartTimeDesc().stream()
                .map(s -> {
                    SessionResponse res = toSessionResponseSummary(s);
                    if (currentUser != null) {
                        res.setIsBookedByCurrentUser(bookedSessionIds.contains(s.getId()));
                    }
                    hideCheckinTokenIfNotHost(res, currentUser);
                    return res;
                })
                .collect(Collectors.toList());
    }

    public List<SessionResponse> getUpcomingSessions(User currentUser) {
        List<Long> bookedSessionIds = (currentUser != null)
                ? participantRepository.findBookedSessionIdsByUserIdOrPhone(currentUser.getId(), currentUser.getPhone())
                : List.of();

        return sessionRepository.findByStatusOrderByStartTimeDesc(SessionStatus.UPCOMING).stream()
                .map(s -> {
                    SessionResponse res = toSessionResponseSummary(s);
                    if (currentUser != null) {
                        res.setIsBookedByCurrentUser(bookedSessionIds.contains(s.getId()));
                    }
                    hideCheckinTokenIfNotHost(res, currentUser);
                    return res;
                })
                .collect(Collectors.toList());
    }

    public SessionResponse getSessionDetail(Long id) {
        return getSessionDetail(id, null);
    }

    public SessionResponse getSessionDetail(Long id, User currentUser) {
        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca đánh!"));

        List<ParticipantResponse> participants = participantRepository.findBySessionIdWithDetails(id).stream()
                .map(this::toParticipantResponse)
                .collect(Collectors.toList());

        SessionResponse response = toSessionResponseSummary(session);
        response.setParticipants(participants);
        if (currentUser != null) {
            boolean isBooked = participants.stream()
                    .anyMatch(p -> ((p.getUserId() != null && p.getUserId().equals(currentUser.getId())) || (p.getPhone() != null && p.getPhone().equals(currentUser.getPhone()))) && p.getCheckinStatus() != CheckinStatus.ABSENT);
            response.setIsBookedByCurrentUser(isBooked);
        }

        hideCheckinTokenIfNotHost(response, currentUser);
        PhoneMasking.maskForViewer(participants, currentUser);
        return response;
    }

    private static boolean isHost(User user) {
        return PhoneMasking.isHost(user);
    }

    /** Mã check-in chỉ dành cho Host (hiển thị QR/token). Người khác phải quét QR hoặc nhập mã do Host cung cấp. */
    private void hideCheckinTokenIfNotHost(SessionResponse response, User currentUser) {
        if (!isHost(currentUser)) {
            response.setCheckinToken(null);
        }
    }

    @Transactional
    public SessionResponse createSession(User host, CreateSessionRequest request) {
        // Validation: Start time must not be in the past
        LocalDateTime now = LocalDateTime.now();
        if (request.getStartTime().isBefore(now.minusMinutes(5))) {
            throw new RuntimeException("Thời gian bắt đầu ca đánh không được ở trong quá khứ!");
        }

        if (request.getEndTime().isBefore(request.getStartTime()) || request.getEndTime().isEqual(request.getStartTime())) {
            throw new RuntimeException("Thời gian kết thúc ca phải sau thời gian bắt đầu!");
        }

        // Validation: Minimum duration must be at least 2 hours (120 minutes)
        long durationMinutes = java.time.Duration.between(request.getStartTime(), request.getEndTime()).toMinutes();
        if (durationMinutes < 120) {
            throw new RuntimeException("Thời lượng ca đánh phải tối thiểu 2 tiếng (120 phút)!");
        }

        PricingCalculator.validateSessionPrices(
                request.getMemberMalePrice(), request.getMemberFemalePrice(),
                request.getGuestMalePrice(), request.getGuestFemalePrice(),
                request.getMemberMalePrice2h(), request.getMemberFemalePrice2h(),
                request.getGuestMalePrice2h(), request.getGuestFemalePrice2h());

        Venue venue = null;

        // 1. If explicit venueName/venueAddress provided, find or create custom Venue
        if (request.getVenueName() != null && !request.getVenueName().isBlank()) {
            String vName = request.getVenueName().trim();
            String vAddress = request.getVenueAddress() != null && !request.getVenueAddress().isBlank()
                    ? request.getVenueAddress().trim()
                    : vName;
            BigDecimal lat = request.getVenueLatitude() != null ? request.getVenueLatitude() : new BigDecimal("10.7380120");
            BigDecimal lng = request.getVenueLongitude() != null ? request.getVenueLongitude() : new BigDecimal("106.7153450");
            Integer radius = request.getVenueRadiusMeters() != null ? request.getVenueRadiusMeters() : 150;

            venue = venueRepository.findAll().stream()
                    .filter(v -> v.getName().equalsIgnoreCase(vName))
                    .findFirst()
                    .orElseGet(() -> venueRepository.save(Venue.builder()
                            .name(vName)
                            .address(vAddress)
                            .latitude(lat)
                            .longitude(lng)
                            .radiusMeters(radius)
                            .build()));
        } else if (request.getVenueId() != null) {
            venue = venueRepository.findById(request.getVenueId()).orElse(null);
        }

        // Fallback to first available or default venue
        if (venue == null) {
            venue = venueRepository.findAll().stream().findFirst().orElseGet(() ->
                    venueRepository.save(Venue.builder()
                            .name("Sân Cầu Lông SmashHub")
                            .address("TP. Hồ Chí Minh")
                            .latitude(new BigDecimal("10.7380120"))
                            .longitude(new BigDecimal("106.7153450"))
                            .radiusMeters(150)
                            .build())
            );
        }

        Session session = Session.builder()
                .venue(venue)
                .host(host)
                .title(request.getTitle())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .status(SessionStatus.UPCOMING)
                .maxSlots(request.getMaxSlots())
                .courtCount(request.getCourtCount() != null ? request.getCourtCount() : 2)
                .courtNames(request.getCourtNames() != null ? request.getCourtNames() : "Sân 1, Sân 2")
                .memberMalePrice(request.getMemberMalePrice())
                .memberFemalePrice(request.getMemberFemalePrice())
                .guestMalePrice(request.getGuestMalePrice())
                .guestFemalePrice(request.getGuestFemalePrice())
                .memberMalePrice2h(request.getMemberMalePrice2h())
                .memberFemalePrice2h(request.getMemberFemalePrice2h())
                .guestMalePrice2h(request.getGuestMalePrice2h())
                .guestFemalePrice2h(request.getGuestFemalePrice2h())
                .depositAmount(request.getDepositAmount())
                .costCourt(request.getCostCourt())
                .costShuttlecock(request.getCostShuttlecock())
                .costDrinks(request.getCostDrinks() != null ? request.getCostDrinks() : BigDecimal.ZERO)
                .checkinToken(UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .tokenExpiresAt(request.getStartTime().plusMinutes(15))
                .build();

        sessionRepository.save(session);
        return toSessionResponseSummary(session);
    }

    @Transactional
    public ParticipantResponse bookPublicSlot(Long sessionId, PublicBookingRequest request) {
        Session session = sessionRepository.findByIdWithLock(sessionId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca đánh!"));

        // Check if session has ended or is cancelled
        LocalDateTime now = LocalDateTime.now();
        if (session.getStatus() == SessionStatus.CANCELLED || now.isAfter(session.getEndTime())) {
            throw new RuntimeException("Ca đánh này đã kết thúc hoặc đã bị hủy, không thể đăng ký thêm!");
        }

        long currentCount = participantRepository.countActiveBookedSlots(sessionId);
        if (currentCount >= session.getMaxSlots()) {
            throw new RuntimeException("Ca đánh này đã đủ quân số (" + currentCount + "/" + session.getMaxSlots() + " slots), không thể đăng ký thêm!");
        }

        if (participantRepository.findBySessionIdAndGuestPhone(sessionId, request.getGuestPhone()).isPresent()) {
            throw new RuntimeException("Số điện thoại này đã đăng ký ca này rồi!");
        }

        // Auto-create or link User account for Guest so they can participate in matchmaker and leaderboards
        User guestUser = userRepository.findByPhone(request.getGuestPhone()).orElseGet(() -> {
            User newUser = User.builder()
                    .phone(request.getGuestPhone())
                    .fullName(request.getGuestName())
                    .gender(request.getGender())
                    .role(Role.GUEST)
                    .password("$2a$10$defaultGuestPlaceholderPasswordHash")
                    .sessionsAttended(0)
                    .winCount(0)
                    .lossCount(0)
                    .eloScore(0)
                    .build();
            return userRepository.save(newUser);
        });

        BigDecimal baseFee = PricingCalculator.baseFee(session, false, request.getGender(), request.getDurationHours());

        // Logic cọc 20k/30%: Chỉ bắt buộc cọc với khách lần đầu đăng ký tham gia CLB SmashHub (past active bookings = 0)
        // Nếu đã từng tham gia từ lần 2 trở đi thì miễn cọc (depositAmount = 0, depositStatus = NONE)
        long pastBookings = participantRepository.countPastBookingsByPhone(request.getGuestPhone());
        boolean isFirstTime = (pastBookings == 0);
        BigDecimal effectiveDeposit = isFirstTime ? (session.getDepositAmount() != null ? session.getDepositAmount() : new BigDecimal("20000")) : BigDecimal.ZERO;
        DepositStatus initialDepositStatus = isFirstTime ? DepositStatus.PENDING : DepositStatus.NONE;

        SessionParticipant participant = SessionParticipant.builder()
                .session(session)
                .user(guestUser)
                .isGuest(true)
                .guestName(request.getGuestName())
                .guestPhone(request.getGuestPhone())
                .gender(request.getGender())
                .durationHours(request.getDurationHours())
                .slotWindow(request.getSlotWindow())
                .checkinStatus(CheckinStatus.PENDING)
                .depositStatus(initialDepositStatus)
                .depositAmount(effectiveDeposit)
                .baseFee(baseFee)
                .adjustmentAmount(BigDecimal.ZERO)
                .finalFee(baseFee)
                .paymentStatus(PaymentStatus.UNPAID)
                .build();

        participantRepository.save(participant);

        // Gửi thông báo Telegram tức thì cho Host (Khách vãng lai book công khai)
        try {
            String timeRange = session.getStartTime().toLocalTime() + " - " + session.getEndTime().toLocalTime();
            String feeNote = isFirstTime ? "Cần cọc 20.000đ (Khách vãng lai lần 1)" : "Miễn cọc (Đã từng tham gia)";
            telegramNotificationService.notifyNewBooking(
                    session.getTitle(),
                    timeRange,
                    request.getGuestName(),
                    request.getGuestPhone(),
                    request.getGender().name(),
                    "Khách vãng lai",
                    feeNote
            );
        } catch (Exception ignored) {}

        return toParticipantResponse(participant);
    }

    @Transactional
    public ParticipantResponse memberJoinSession(Long sessionId, User user, com.smashflow.dto.JoinSessionRequest request) {
        Session session = sessionRepository.findByIdWithLock(sessionId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca đánh!"));

        // Check if session has ended or is cancelled
        LocalDateTime now = LocalDateTime.now();
        if (session.getStatus() == SessionStatus.CANCELLED || now.isAfter(session.getEndTime())) {
            throw new RuntimeException("Ca đánh này đã kết thúc hoặc đã bị hủy, không thể đăng ký thêm!");
        }

        long currentCount = participantRepository.countActiveBookedSlots(sessionId);
        if (currentCount >= session.getMaxSlots()) {
            throw new RuntimeException("Ca đánh này đã đủ quân số (" + currentCount + "/" + session.getMaxSlots() + " slots), không thể đăng ký thêm!");
        }

        if (participantRepository.findBySessionIdAndUserId(sessionId, user.getId()).isPresent()) {
            throw new RuntimeException("Bạn đã tham gia ca này rồi!");
        }

        // Chỉ thành viên chính thức (FIXED hoặc HOST) mới được nhận giá Thành viên CLB, còn PENDING_FIXED / CASUAL nhận giá Vãng lai
        boolean isOfficialFixedMember = user.getRole() == Role.HOST || user.getMembershipType() == com.smashflow.model.MembershipType.FIXED;

        BigDecimal durationHours = (request != null && request.getDurationHours() != null) ? request.getDurationHours() : null;

        BigDecimal baseFee = PricingCalculator.baseFee(session, isOfficialFixedMember, user.getGender(), durationHours);

        // Logic cọc 20k: Nếu là thành viên vãng lai (hoặc chưa duyệt cố định) và là LẦN ĐẦU tham gia CLB (pastBookings == 0) -> Bắt buộc cọc
        long pastBookings = participantRepository.countPastBookingsByPhone(user.getPhone());
        boolean needDeposit = !isOfficialFixedMember && (pastBookings == 0);
        BigDecimal effectiveDeposit = needDeposit
                ? (session.getDepositAmount() != null ? session.getDepositAmount() : new BigDecimal("20000"))
                : BigDecimal.ZERO;
        DepositStatus initialDepositStatus = needDeposit ? DepositStatus.PENDING : DepositStatus.NONE;

        // Auto apply voucher if user has unclaimed voucher reward
        BigDecimal adjustmentAmount = BigDecimal.ZERO;
        String adjustmentReason = null;
        Long voucherRewardId = null;
        List<LoyaltyReward> pendingRewards = loyaltyRewardRepository.findByUserIdAndIsClaimedFalseOrderByMilestoneSessionsAsc(user.getId());
        for (LoyaltyReward r : pendingRewards) {
            Integer discountPercent = LoyaltyRewardService.getVoucherDiscountPercent(r.getMilestoneSessions());
            if (discountPercent != null && discountPercent > 0) {
                adjustmentAmount = PricingCalculator.voucherDiscount(baseFee, discountPercent);
                adjustmentReason = "Áp dụng Voucher " + discountPercent + "% (Mốc " + r.getMilestoneSessions() + " buổi)";
                voucherRewardId = r.getId();
                r.setIsClaimed(true);
                r.setClaimedAt(LocalDateTime.now());
                loyaltyRewardRepository.save(r);
                break; // Chỉ dùng 1 voucher cho 1 lượt đăng ký ca đánh
            }
        }

        BigDecimal finalFee = PricingCalculator.finalFee(baseFee, adjustmentAmount);

        SessionParticipant participant = SessionParticipant.builder()
                .session(session)
                .user(user)
                .isGuest(!isOfficialFixedMember)
                .gender(user.getGender())
                .durationHours(durationHours)
                .slotWindow(request != null ? request.getSlotWindow() : null)
                .checkinStatus(CheckinStatus.PENDING)
                .depositStatus(initialDepositStatus)
                .depositAmount(effectiveDeposit)
                .baseFee(baseFee)
                .adjustmentAmount(adjustmentAmount)
                .adjustmentReason(adjustmentReason)
                .voucherRewardId(voucherRewardId)
                .finalFee(finalFee)
                .paymentStatus(PaymentStatus.UNPAID)
                .build();

        participantRepository.save(participant);

        // Gửi thông báo Telegram tức thì cho Host (Member có tài khoản join)
        try {
            String timeRange = session.getStartTime().toLocalTime() + " - " + session.getEndTime().toLocalTime();
            String durationText = durationHours != null ? " (" + durationHours + " tiếng)" : " (Full ca)";
            String mTypeName = isOfficialFixedMember
                    ? "Thành viên Cố định" + durationText
                    : ((user.getSessionsAttended() != null && user.getSessionsAttended() > 0) ? "Thành viên CLB (Miễn cọc)" + durationText : "Vãng lai lần 1" + durationText);
            String feeNote = needDeposit ? "Cần cọc 20.000đ (Khách lần 1)" : "Miễn cọc (Thành viên CLB)";

            telegramNotificationService.notifyNewBooking(
                    session.getTitle(),
                    timeRange,
                    user.getFullName(),
                    user.getPhone(),
                    user.getGender().name(),
                    mTypeName,
                    feeNote
            );
        } catch (Exception ignored) {}

        return toParticipantResponse(participant);
    }

    @Transactional
    public ParticipantResponse confirmDeposit(Long participantId) {
        SessionParticipant participant = participantRepository.findByIdForUpdate(participantId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        // Chỉ xác nhận được từ trạng thái đang chờ cọc (không "hồi sinh" cọc đã giữ / đã hoàn)
        if (participant.getDepositStatus() != DepositStatus.PENDING) {
            throw new RuntimeException(switch (participant.getDepositStatus()) {
                case PAID -> "Lượt này đã được xác nhận cọc rồi!";
                case FORFEITED -> "Cọc của lượt này đã bị giữ do vắng mặt, không thể xác nhận lại!";
                case REFUNDED -> "Cọc của lượt này đã được hoàn trả, không thể xác nhận lại!";
                default -> "Lượt này không có cọc đang chờ xác nhận!";
            });
        }
        if (participant.getPaymentStatus() == PaymentStatus.PAID) {
            throw new RuntimeException("Lượt này đã thanh toán đủ tiền (chưa trừ cọc), không cần xác nhận cọc nữa!");
        }

        participant.setDepositStatus(DepositStatus.PAID);
        participantRepository.save(participant);

        try {
            String pName = participant.getUser() != null ? participant.getUser().getFullName() : participant.getGuestName();
            String pPhone = participant.getUser() != null ? participant.getUser().getPhone() : participant.getGuestPhone();
            telegramNotificationService.notifyDepositReceived(
                    participant.getSession().getTitle(),
                    pName,
                    pPhone,
                    participant.getDepositAmount().toString()
            );
        } catch (Exception ignored) {}

        return toParticipantResponse(participant);
    }

    /** Mã đối soát chuyển khoản theo lượt đăng ký (ASCII, ngắn, không chứa SĐT). */
    public static String paymentCode(Long participantId) {
        return "SF" + participantId;
    }

    public static String depositMemo(Long participantId) {
        return "COC " + paymentCode(participantId);
    }

    public static String finalPaymentMemo(Long participantId) {
        return paymentCode(participantId);
    }

    public String getDepositQrUrl(Long participantId, User viewer) {
        SessionParticipant participant = findParticipantForQr(participantId, viewer);
        return vietQrService.generateQrUrl(participant.getDepositAmount(), depositMemo(participant.getId()));
    }

    public String getFinalPaymentQrUrl(Long participantId, User viewer) {
        SessionParticipant participant = findParticipantForQr(participantId, viewer);
        BigDecimal remaining = participant.getRemainingPaymentAmount();
        return vietQrService.generateQrUrl(remaining, finalPaymentMemo(participant.getId()));
    }

    /** Chỉ Host hoặc chính chủ lượt đăng ký mới được xem mã QR chuyển khoản. */
    private SessionParticipant findParticipantForQr(Long participantId, User viewer) {
        if (viewer == null) {
            throw new AccessDeniedException("Bạn cần đăng nhập để xem mã QR thanh toán!");
        }
        SessionParticipant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));
        boolean isOwner = participant.getUser() != null
                && participant.getUser().getId() != null
                && participant.getUser().getId().equals(viewer.getId());
        if (!isHost(viewer) && !isOwner) {
            throw new AccessDeniedException("Bạn không có quyền xem mã QR thanh toán của người khác!");
        }
        return participant;
    }

    @Transactional
    public SessionResponse updateSession(Long sessionId, UpdateSessionRequest request) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca đánh!"));

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            session.setTitle(request.getTitle().trim());
        }

        if (request.getCourtNames() != null && !request.getCourtNames().isBlank()) {
            String names = request.getCourtNames().trim();
            int count = (int) java.util.Arrays.stream(names.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .count();
            session.setCourtNames(names);
            session.setCourtCount(Math.max(1, count));
        }

        if (request.getMaxSlots() != null && request.getMaxSlots() > 0) {
            session.setMaxSlots(request.getMaxSlots());
        }
        if (request.getStartTime() != null) session.setStartTime(request.getStartTime());
        if (request.getEndTime() != null) session.setEndTime(request.getEndTime());
        if (session.getStartTime() != null && session.getEndTime() != null) {
            long durMin = java.time.Duration.between(session.getStartTime(), session.getEndTime()).toMinutes();
            if (durMin < 120) {
                throw new RuntimeException("Thời lượng ca đánh phải tối thiểu 2 tiếng (120 phút)!");
            }
        }
        if (request.getVenueName() != null && !request.getVenueName().isBlank()) {
            Venue venue = session.getVenue();
            if (venue != null) {
                venue.setName(request.getVenueName().trim());
                if (request.getVenueAddress() != null && !request.getVenueAddress().isBlank()) {
                    venue.setAddress(request.getVenueAddress().trim());
                }
                venueRepository.save(venue);
            }
        }
        PricingCalculator.validateSessionPrices(
                request.getMemberMalePrice() != null ? request.getMemberMalePrice() : session.getMemberMalePrice(),
                request.getMemberFemalePrice() != null ? request.getMemberFemalePrice() : session.getMemberFemalePrice(),
                request.getGuestMalePrice() != null ? request.getGuestMalePrice() : session.getGuestMalePrice(),
                request.getGuestFemalePrice() != null ? request.getGuestFemalePrice() : session.getGuestFemalePrice(),
                request.getMemberMalePrice2h(), request.getMemberFemalePrice2h(),
                request.getGuestMalePrice2h(), request.getGuestFemalePrice2h());

        // Chỉ tính lại giá người tham gia khi có trường giá thực sự thay đổi (sửa tiêu đề/giờ/sân thì không)
        boolean pricesChanged = priceChanged(session.getMemberMalePrice(), request.getMemberMalePrice())
                | priceChanged(session.getMemberFemalePrice(), request.getMemberFemalePrice())
                | priceChanged(session.getGuestMalePrice(), request.getGuestMalePrice())
                | priceChanged(session.getGuestFemalePrice(), request.getGuestFemalePrice())
                | priceChanged(session.getMemberMalePrice2h(), request.getMemberMalePrice2h())
                | priceChanged(session.getMemberFemalePrice2h(), request.getMemberFemalePrice2h())
                | priceChanged(session.getGuestMalePrice2h(), request.getGuestMalePrice2h())
                | priceChanged(session.getGuestFemalePrice2h(), request.getGuestFemalePrice2h());

        if (request.getMemberMalePrice() != null) session.setMemberMalePrice(request.getMemberMalePrice());
        if (request.getMemberFemalePrice() != null) session.setMemberFemalePrice(request.getMemberFemalePrice());
        if (request.getGuestMalePrice() != null) session.setGuestMalePrice(request.getGuestMalePrice());
        if (request.getGuestFemalePrice() != null) session.setGuestFemalePrice(request.getGuestFemalePrice());
        if (request.getMemberMalePrice2h() != null) session.setMemberMalePrice2h(request.getMemberMalePrice2h());
        if (request.getMemberFemalePrice2h() != null) session.setMemberFemalePrice2h(request.getMemberFemalePrice2h());
        if (request.getGuestMalePrice2h() != null) session.setGuestMalePrice2h(request.getGuestMalePrice2h());
        if (request.getGuestFemalePrice2h() != null) session.setGuestFemalePrice2h(request.getGuestFemalePrice2h());
        if (request.getDepositAmount() != null) session.setDepositAmount(request.getDepositAmount());
        if (request.getCostCourt() != null) session.setCostCourt(request.getCostCourt());
        if (request.getCostShuttlecock() != null) session.setCostShuttlecock(request.getCostShuttlecock());
        if (request.getCostDrinks() != null) session.setCostDrinks(request.getCostDrinks());

        sessionRepository.save(session);

        if (pricesChanged) {
            // Tính lại giá vé theo bảng giá mới, bỏ qua lượt đã chốt (đã thanh toán / vắng / bị giữ cọc).
            // Điều chỉnh tay của Host giữ nguyên, voucher % tính lại theo giá gốc mới.
            for (SessionParticipant p : participantRepository.findBySessionId(sessionId)) {
                if (p.getPaymentStatus() == PaymentStatus.PAID) continue;
                if (p.getCheckinStatus() == CheckinStatus.ABSENT) continue;
                if (p.getDepositStatus() == DepositStatus.FORFEITED) continue;
                boolean memberTier = !Boolean.TRUE.equals(p.getIsGuest());
                if (PricingCalculator.reprice(p, session, memberTier, p.getGender(), p.getDurationHours())) {
                    participantRepository.save(p);
                }
            }
        }

        return toSessionResponseSummary(session);
    }

    /** Trường giá trong request có làm đổi giá hiện tại không (null = không gửi = không đổi). */
    private static boolean priceChanged(BigDecimal current, BigDecimal requested) {
        if (requested == null) return false;
        return current == null || current.compareTo(requested) != 0;
    }

    @Transactional
    public SessionResponse updateCourts(Long sessionId, UpdateSessionCourtsRequest request) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca đánh!"));

        String names = request.getCourtNames().trim();
        int count = (int) java.util.Arrays.stream(names.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .count();

        session.setCourtNames(names);
        session.setCourtCount(Math.max(1, count));
        if (request.getMaxSlots() != null && request.getMaxSlots() > 0) {
            session.setMaxSlots(request.getMaxSlots());
        }
        sessionRepository.save(session);
        return toSessionResponseSummary(session);
    }

    @Transactional
    public void removeParticipant(Long participantId, boolean forfeitDeposit) {
        SessionParticipant participant = participantRepository.findByIdForUpdate(participantId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        // Lượt đã thu tiền: xóa sẽ làm mất tiền khỏi báo cáo → phải hoàn tác thu trước
        if (participant.getPaymentStatus() == PaymentStatus.PAID) {
            throw new RuntimeException("Lượt đã thanh toán, vui lòng hoàn tác thu tiền trước khi xóa!");
        }

        // If user already checked in at venue, prevent deleting to preserve match logs & accounting
        if (participant.getCheckinStatus() == CheckinStatus.CHECKED_IN) {
            throw new RuntimeException("Người này đã tới sân và điểm danh, không thể xóa!");
        }

        // Nếu hủy slot và trước đó đã tự động áp voucher, hoàn lại đúng voucher đó cho member
        refundAppliedVoucher(participant);

        if (forfeitDeposit && participant.getDepositStatus() == DepositStatus.PAID) {
            // Mark as ABSENT / FORFEITED to keep deposit in session revenue while releasing the slot count
            participant.setDepositStatus(DepositStatus.FORFEITED);
            participant.setCheckinStatus(CheckinStatus.ABSENT);
            participant.setPaymentStatus(PaymentStatus.PAID);
            participant.setPaidAt(LocalDateTime.now());
            participant.setFinalFee(participant.getDepositAmount()); // Revenue recognizes deposit
            participant.setVoucherRewardId(null); // voucher đã hoàn ở trên
            participantRepository.save(participant);

            try {
                String pName = participant.getUser() != null ? participant.getUser().getFullName() : participant.getGuestName();
                String pPhone = participant.getUser() != null ? participant.getUser().getPhone() : participant.getGuestPhone();
                telegramNotificationService.notifySlotCancelled(participant.getSession().getTitle(), pName, pPhone, true);
            } catch (Exception ignored) {}
        } else {
            String pName = participant.getUser() != null ? participant.getUser().getFullName() : participant.getGuestName();
            String pPhone = participant.getUser() != null ? participant.getUser().getPhone() : participant.getGuestPhone();
            String sTitle = participant.getSession().getTitle();
            // Completely cancel and remove booking slot
            participantRepository.delete(participant);

            try {
                telegramNotificationService.notifySlotCancelled(sTitle, pName, pPhone, false);
            } catch (Exception ignored) {}
        }
    }

    /**
     * Hoàn voucher đã tự áp khi đăng ký. Lượt mới lưu voucher_reward_id → hoàn đúng phần thưởng đó;
     * lượt cũ (chưa có cột) mới dò theo nội dung "Voucher N%" như trước.
     */
    private void refundAppliedVoucher(SessionParticipant participant) {
        if (participant.getUser() == null) return;

        if (participant.getVoucherRewardId() != null) {
            loyaltyRewardRepository.findById(participant.getVoucherRewardId()).ifPresent(r -> {
                if (Boolean.TRUE.equals(r.getIsClaimed())) {
                    r.setIsClaimed(false);
                    r.setClaimedAt(null);
                    loyaltyRewardRepository.save(r);
                }
            });
            return;
        }

        // Dữ liệu cũ: dò theo % trong lý do điều chỉnh
        if (participant.getAdjustmentAmount() != null && participant.getAdjustmentAmount().compareTo(BigDecimal.ZERO) < 0
                && participant.getAdjustmentReason() != null && participant.getAdjustmentReason().contains("Voucher")) {
            List<LoyaltyReward> claimedRewards = loyaltyRewardRepository.findByUserIdOrderByMilestoneSessionsAsc(participant.getUser().getId());
            for (LoyaltyReward r : claimedRewards) {
                if (Boolean.TRUE.equals(r.getIsClaimed())) {
                    Integer percent = LoyaltyRewardService.getVoucherDiscountPercent(r.getMilestoneSessions());
                    if (percent != null && participant.getAdjustmentReason().contains(percent + "%")) {
                        r.setIsClaimed(false);
                        r.setClaimedAt(null);
                        loyaltyRewardRepository.save(r);
                        break;
                    }
                }
            }
        }
    }

    private SessionResponse toSessionResponseSummary(Session session) {
        long booked = participantRepository.countActiveBookedSlots(session.getId());
        long checkedIn = participantRepository.countBySessionIdAndCheckinStatus(session.getId(), CheckinStatus.CHECKED_IN);

        // Real-time status sync based on actual wall-clock time
        LocalDateTime now = LocalDateTime.now();
        SessionStatus effectiveStatus = session.getStatus();
        if (effectiveStatus != SessionStatus.CANCELLED) {
            if (now.isAfter(session.getEndTime())) {
                effectiveStatus = SessionStatus.COMPLETED;
            } else if (now.isAfter(session.getStartTime()) && now.isBefore(session.getEndTime())) {
                effectiveStatus = SessionStatus.ACTIVE;
            } else if (now.isBefore(session.getStartTime())) {
                effectiveStatus = SessionStatus.UPCOMING;
            }
        }

        return SessionResponse.builder()
                .id(session.getId())
                .venueId(session.getVenue().getId())
                .venueName(session.getVenue().getName())
                .venueAddress(session.getVenue().getAddress())
                .venueLatitude(session.getVenue().getLatitude())
                .venueLongitude(session.getVenue().getLongitude())
                .venueRadiusMeters(session.getVenue().getRadiusMeters())
                .hostId(session.getHost().getId())
                .hostName(session.getHost().getFullName())
                .title(session.getTitle())
                .startTime(session.getStartTime())
                .endTime(session.getEndTime())
                .status(effectiveStatus)
                .maxSlots(session.getMaxSlots())
                .courtCount(session.getCourtCount() != null ? session.getCourtCount() : 2)
                .courtNames(session.getCourtNames() != null ? session.getCourtNames() : "Sân 1, Sân 2")
                .bookedSlots((int) booked)
                .checkedInSlots((int) checkedIn)
                .memberMalePrice(session.getMemberMalePrice())
                .memberFemalePrice(session.getMemberFemalePrice())
                .guestMalePrice(session.getGuestMalePrice())
                .guestFemalePrice(session.getGuestFemalePrice())
                .memberMalePrice2h(session.getMemberMalePrice2h())
                .memberFemalePrice2h(session.getMemberFemalePrice2h())
                .guestMalePrice2h(session.getGuestMalePrice2h())
                .guestFemalePrice2h(session.getGuestFemalePrice2h())
                .depositAmount(session.getDepositAmount())
                .costCourt(session.getCostCourt())
                .costShuttlecock(session.getCostShuttlecock())
                .costDrinks(session.getCostDrinks())
                .checkinToken(session.getCheckinToken())
                .tokenExpiresAt(session.getTokenExpiresAt())
                .build();
    }

    private ParticipantResponse toParticipantResponse(SessionParticipant p) {
        String name = (p.getUser() != null && p.getUser().getFullName() != null && !p.getUser().getFullName().isBlank())
                ? p.getUser().getFullName()
                : (p.getGuestName() != null && !p.getGuestName().isBlank() ? p.getGuestName() : "N/A");

        String phone = (p.getUser() != null && p.getUser().getPhone() != null && !p.getUser().getPhone().isBlank())
                ? p.getUser().getPhone()
                : (p.getGuestPhone() != null && !p.getGuestPhone().isBlank() ? p.getGuestPhone() : "N/A");

        return ParticipantResponse.builder()
                .id(p.getId())
                .sessionId(p.getSession().getId())
                .userId(p.getUser() != null ? p.getUser().getId() : null)
                .isGuest(p.getIsGuest())
                .name(name)
                .phone(phone)
                .gender(p.getGender())
                .checkinStatus(p.getCheckinStatus())
                .checkinAt(p.getCheckinAt())
                .depositStatus(p.getDepositStatus())
                .depositAmount(p.getDepositAmount())
                .baseFee(p.getBaseFee())
                .durationHours(p.getDurationHours())
                .slotWindow(p.getSlotWindow())
                .adjustmentAmount(p.getAdjustmentAmount())
                .adjustmentReason(p.getAdjustmentReason())
                .finalFee(p.getFinalFee())
                .remainingAmount(p.getRemainingPaymentAmount())
                .paymentStatus(p.getPaymentStatus())
                .paymentMethod(p.getPaymentMethod())
                .paidAt(p.getPaidAt())
                .canUndoPayment(PricingCalculator.canUndoPayment(p, LocalDateTime.now()))
                .winCount(p.getUser() != null ? p.getUser().getWinCount() : 0)
                .lossCount(p.getUser() != null ? p.getUser().getLossCount() : 0)
                .eloScore(p.getUser() != null ? p.getUser().getEloScore() : 0)
                .placementMatches(p.getUser() != null ? (p.getUser().getPlacementMatches() != null ? p.getUser().getPlacementMatches() : 0) : 0)
                .currentStreak(p.getUser() != null ? (p.getUser().getCurrentStreak() != null ? p.getUser().getCurrentStreak() : 0) : 0)
                .shieldMatches(p.getUser() != null ? (p.getUser().getShieldMatches() != null ? p.getUser().getShieldMatches() : 0) : 0)
                .avatarUrl(p.getUser() != null ? p.getUser().getAvatarUrl() : "/duck-mascot.png")
                .build();
    }
}
