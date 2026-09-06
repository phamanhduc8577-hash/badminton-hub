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
    private final MatchRepository matchRepository;
    private final VietQrService vietQrService;
    private final TelegramNotificationService telegramNotificationService;

    public List<SessionResponse> getAllSessions() {
        return sessionRepository.findAllByOrderByStartTimeDesc().stream()
                .map(this::toSessionResponseSummary)
                .collect(Collectors.toList());
    }

    public List<SessionResponse> getUpcomingSessions() {
        return sessionRepository.findByStatusOrderByStartTimeDesc(SessionStatus.UPCOMING).stream()
                .map(this::toSessionResponseSummary)
                .collect(Collectors.toList());
    }

    public SessionResponse getSessionDetail(Long id) {
        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca đánh!"));

        List<ParticipantResponse> participants = participantRepository.findBySessionIdWithDetails(id).stream()
                .map(this::toParticipantResponse)
                .collect(Collectors.toList());

        SessionResponse response = toSessionResponseSummary(session);
        response.setParticipants(participants);
        return response;
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

        BigDecimal baseFee;
        if (request.getDurationHours() != null && request.getDurationHours().compareTo(new BigDecimal("2.0")) == 0 && session.getGuestMalePrice2h() != null) {
            baseFee = request.getGender() == Gender.FEMALE
                    ? (session.getGuestFemalePrice2h() != null ? session.getGuestFemalePrice2h() : session.getGuestFemalePrice())
                    : (session.getGuestMalePrice2h() != null ? session.getGuestMalePrice2h() : session.getGuestMalePrice());
        } else {
            baseFee = request.getGender() == Gender.FEMALE
                    ? session.getGuestFemalePrice()
                    : session.getGuestMalePrice();
        }

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
    public ParticipantResponse memberJoinSession(Long sessionId, User user) {
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

        BigDecimal baseFee;
        if (isOfficialFixedMember) {
            baseFee = user.getGender() == Gender.FEMALE
                    ? session.getMemberFemalePrice()
                    : session.getMemberMalePrice();
        } else {
            baseFee = user.getGender() == Gender.FEMALE
                    ? session.getGuestFemalePrice()
                    : session.getGuestMalePrice();
        }

        // Logic cọc 20k: Nếu là thành viên vãng lai (hoặc chưa duyệt cố định) và là LẦN ĐẦU tham gia CLB (pastBookings == 0) -> Bắt buộc cọc
        long pastBookings = participantRepository.countPastBookingsByPhone(user.getPhone());
        boolean needDeposit = !isOfficialFixedMember && (pastBookings == 0);
        BigDecimal effectiveDeposit = needDeposit
                ? (session.getDepositAmount() != null ? session.getDepositAmount() : new BigDecimal("20000"))
                : BigDecimal.ZERO;
        DepositStatus initialDepositStatus = needDeposit ? DepositStatus.PENDING : DepositStatus.NONE;

        SessionParticipant participant = SessionParticipant.builder()
                .session(session)
                .user(user)
                .isGuest(!isOfficialFixedMember)
                .gender(user.getGender())
                .checkinStatus(CheckinStatus.PENDING)
                .depositStatus(initialDepositStatus)
                .depositAmount(effectiveDeposit)
                .baseFee(baseFee)
                .adjustmentAmount(BigDecimal.ZERO)
                .finalFee(baseFee)
                .paymentStatus(PaymentStatus.UNPAID)
                .build();

        participantRepository.save(participant);

        // Gửi thông báo Telegram tức thì cho Host (Member có tài khoản join)
        try {
            String timeRange = session.getStartTime().toLocalTime() + " - " + session.getEndTime().toLocalTime();
            String mTypeName = isOfficialFixedMember
                    ? "Thành viên Cố định"
                    : ((user.getSessionsAttended() != null && user.getSessionsAttended() > 0) ? "Thành viên CLB (Miễn cọc)" : "Vãng lai lần 1");
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
        SessionParticipant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

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

    public String getDepositQrUrl(Long participantId) {
        SessionParticipant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        String phone = participant.getIsGuest() ? participant.getGuestPhone() : participant.getUser().getPhone();
        String memo = "COC " + participant.getSession().getId() + " " + phone;
        return vietQrService.generateQrUrl(participant.getDepositAmount(), memo);
    }

    public String getFinalPaymentQrUrl(Long participantId) {
        SessionParticipant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        BigDecimal remaining = participant.getRemainingPaymentAmount();
        String phone = participant.getIsGuest() ? participant.getGuestPhone() : participant.getUser().getPhone();
        String memo = "PAY " + participant.getSession().getId() + " " + phone;
        return vietQrService.generateQrUrl(remaining, memo);
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
        if (request.getMemberMalePrice() != null) session.setMemberMalePrice(request.getMemberMalePrice());
        if (request.getMemberFemalePrice() != null) session.setMemberFemalePrice(request.getMemberFemalePrice());
        if (request.getGuestMalePrice() != null) session.setGuestMalePrice(request.getGuestMalePrice());
        if (request.getGuestFemalePrice() != null) session.setGuestFemalePrice(request.getGuestFemalePrice());
        if (request.getDepositAmount() != null) session.setDepositAmount(request.getDepositAmount());
        if (request.getCostCourt() != null) session.setCostCourt(request.getCostCourt());
        if (request.getCostShuttlecock() != null) session.setCostShuttlecock(request.getCostShuttlecock());

        sessionRepository.save(session);
        return toSessionResponseSummary(session);
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
        SessionParticipant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người tham gia!"));

        // If user already checked in at venue, prevent deleting to preserve match logs & accounting
        if (participant.getCheckinStatus() == CheckinStatus.CHECKED_IN) {
            throw new RuntimeException("Người này đã tới sân và điểm danh, không thể xóa!");
        }

        if (forfeitDeposit && participant.getDepositStatus() == DepositStatus.PAID) {
            // Mark as ABSENT / FORFEITED to keep deposit in session revenue while releasing the slot count
            participant.setDepositStatus(DepositStatus.FORFEITED);
            participant.setCheckinStatus(CheckinStatus.ABSENT);
            participant.setPaymentStatus(PaymentStatus.PAID);
            participant.setFinalFee(participant.getDepositAmount()); // Revenue recognizes deposit
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

    @Transactional
    public java.util.Map<String, Object> autoSeedFullSimulation(Long sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca đánh!"));

        long currentCount = participantRepository.countBySessionId(sessionId);
        int remainingSlots = session.getMaxSlots() - (int) currentCount;
        if (remainingSlots <= 0) {
            throw new RuntimeException("Ca đánh đã đầy quân số (" + currentCount + "/" + session.getMaxSlots() + ")!");
        }

        // 1. Fetch available members to join without exceeding maxSlots
        List<User> users = userRepository.findAll().stream()
                .filter(u -> u.getRole() != Role.HOST)
                .limit(Math.min(remainingSlots, 8))
                .collect(Collectors.toList());

        for (User u : users) {
            if (participantRepository.countBySessionId(sessionId) >= session.getMaxSlots()) {
                break;
            }
            if (participantRepository.findBySessionIdAndUserId(sessionId, u.getId()).isEmpty()) {
                SessionParticipant sp = SessionParticipant.builder()
                        .session(session)
                        .user(u)
                        .isGuest(false)
                        .gender(u.getGender())
                        .checkinStatus(CheckinStatus.CHECKED_IN)
                        .checkinAt(LocalDateTime.now())
                        .depositStatus(DepositStatus.NONE)
                        .depositAmount(BigDecimal.ZERO)
                        .baseFee(u.getGender() == Gender.FEMALE ? session.getMemberFemalePrice() : session.getMemberMalePrice())
                        .adjustmentAmount(BigDecimal.ZERO)
                        .finalFee(u.getGender() == Gender.FEMALE ? session.getMemberFemalePrice() : session.getMemberMalePrice())
                        .paymentStatus(PaymentStatus.PAID)
                        .paymentMethod(PaymentMethod.CASH)
                        .build();
                participantRepository.save(sp);
            }
        }

        // 2. Generate 6 fair match sets for comprehensive simulation
        if (users.size() >= 4 && matchRepository.findBySessionIdOrderByCreatedAtDesc(sessionId).isEmpty()) {
            for (int i = 0; i < 6; i++) {
                User pA1 = users.get(i % users.size());
                User pA2 = users.get((i + 1) % users.size());
                User pB1 = users.get((i + 2) % users.size());
                User pB2 = users.get((i + 3) % users.size());

                WinningTeam win = (i % 2 == 0) ? WinningTeam.A : WinningTeam.B;
                Match m = Match.builder()
                        .session(session)
                        .teamAPlayer1(pA1)
                        .teamAPlayer2(pA2)
                        .teamBPlayer1(pB1)
                        .teamBPlayer2(pB2)
                        .winningTeam(win)
                        .courtName("Sân " + ((i % 2) + 1))
                        .build();
                matchRepository.save(m);

                // Update user stats
                if (win == WinningTeam.A) {
                    pA1.setWinCount(pA1.getWinCount() + 1);
                    pA1.setEloScore(pA1.getEloScore() + 1);
                    pA2.setWinCount(pA2.getWinCount() + 1);
                    pA2.setEloScore(pA2.getEloScore() + 1);
                    pB1.setLossCount(pB1.getLossCount() + 1);
                    pB1.setEloScore(Math.max(0, pB1.getEloScore() - 1));
                    pB2.setLossCount(pB2.getLossCount() + 1);
                    pB2.setEloScore(Math.max(0, pB2.getEloScore() - 1));
                } else {
                    pB1.setWinCount(pB1.getWinCount() + 1);
                    pB1.setEloScore(pB1.getEloScore() + 1);
                    pB2.setWinCount(pB2.getWinCount() + 1);
                    pB2.setEloScore(pB2.getEloScore() + 1);
                    pA1.setLossCount(pA1.getLossCount() + 1);
                    pA1.setEloScore(Math.max(0, pA1.getEloScore() - 1));
                    pA2.setLossCount(pA2.getLossCount() + 1);
                    pA2.setEloScore(Math.max(0, pA2.getEloScore() - 1));
                }
                userRepository.saveAll(List.of(pA1, pA2, pB1, pB2));
            }
        }

        java.util.Map<String, Object> res = new java.util.HashMap<>();
        res.put("success", true);
        res.put("message", "Đã nạp 8 thành viên ảo, điểm danh GPS và mô phỏng 6 set đấu công bằng!");
        return res;
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
                .adjustmentAmount(p.getAdjustmentAmount())
                .adjustmentReason(p.getAdjustmentReason())
                .finalFee(p.getFinalFee())
                .remainingAmount(p.getRemainingPaymentAmount())
                .paymentStatus(p.getPaymentStatus())
                .paymentMethod(p.getPaymentMethod())
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
