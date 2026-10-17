package com.smashflow.service;

import com.smashflow.dto.JoinSessionRequest;
import com.smashflow.dto.PublicBookingRequest;
import com.smashflow.dto.SessionResponse;
import com.smashflow.dto.SettlePaymentRequest;
import com.smashflow.dto.UpdateSessionRequest;
import com.smashflow.model.*;
import com.smashflow.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Đợt 5 (backend): trạng thái ca, giá dự kiến cho người xem, hủy ca, đặt lại sau khi vắng, sửa địa điểm, xóa giá 2h. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SessionLifecycleAndBookingTest {

    @Mock private SessionRepository sessionRepository;
    @Mock private SessionParticipantRepository participantRepository;
    @Mock private VenueRepository venueRepository;
    @Mock private UserRepository userRepository;
    @Mock private VietQrService vietQrService;
    @Mock private TelegramNotificationService telegramNotificationService;
    @Mock private LoyaltyRewardRepository loyaltyRewardRepository;
    @InjectMocks private SessionService service;

    private User host;
    private User member;
    private Venue venue;
    private Session session;
    private final List<SessionParticipant> roster = new ArrayList<>();

    @BeforeEach
    void setUp() {
        host = User.builder().id(1L).fullName("Host").phone("0325000001").role(Role.HOST)
                .membershipType(MembershipType.FIXED).build();
        member = User.builder().id(7L).fullName("Thành Viên").phone("0900000007").role(Role.MEMBER)
                .gender(Gender.MALE).membershipType(MembershipType.CASUAL).build();
        venue = Venue.builder().id(1L).name("Sân A").address("Q7")
                .latitude(new BigDecimal("10.1")).longitude(new BigDecimal("106.1")).radiusMeters(100).build();
        session = Session.builder().id(5L).title("Ca tối").venue(venue).host(host).maxSlots(10)
                .startTime(LocalDateTime.now().plusDays(1)).endTime(LocalDateTime.now().plusDays(1).plusHours(3))
                .memberMalePrice(new BigDecimal("50000")).memberFemalePrice(new BigDecimal("40000"))
                .guestMalePrice(new BigDecimal("60000")).guestFemalePrice(new BigDecimal("50000"))
                .depositAmount(new BigDecimal("30000"))
                .build();
        roster.clear();
        when(sessionRepository.findById(5L)).thenReturn(Optional.of(session));
        when(sessionRepository.findByIdWithLock(5L)).thenReturn(Optional.of(session));
        when(participantRepository.findBySessionId(5L)).thenReturn(roster);
        when(participantRepository.findBySessionIdWithDetails(5L)).thenReturn(roster);
        when(participantRepository.findBySessionAndUserOrPhone(anyLong(), any(), any())).thenReturn(List.of());
        when(participantRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(userRepository.save(any())).thenAnswer(i -> {
            User u = i.getArgument(0);
            if (u.getId() == null) u.setId(500L);
            return u;
        });
        when(venueRepository.save(any())).thenAnswer(i -> {
            Venue v = i.getArgument(0);
            if (v.getId() == null) v.setId(99L);
            return v;
        });
    }

    private SessionParticipant row(long id, User user) {
        SessionParticipant p = SessionParticipant.builder().id(id).session(session).user(user).isGuest(true)
                .gender(Gender.MALE).baseFee(new BigDecimal("60000")).finalFee(new BigDecimal("60000")).build();
        roster.add(p);
        return p;
    }

    private PublicBookingRequest booking(String phone) {
        PublicBookingRequest r = new PublicBookingRequest();
        r.setGuestName("Khách");
        r.setGuestPhone(phone);
        r.setGender(Gender.MALE);
        return r;
    }

    private SessionParticipant captureSaved() {
        ArgumentCaptor<SessionParticipant> c = ArgumentCaptor.forClass(SessionParticipant.class);
        verify(participantRepository, atLeastOnce()).save(c.capture());
        return c.getValue();
    }

    // ---------- 5.2: trạng thái theo giờ ----------

    @Test
    @DisplayName("effectiveStatus: CANCELLED thắng; trước giờ = UPCOMING; trong ca (kể cả 2 mốc) = ACTIVE; sau giờ = COMPLETED")
    void effectiveStatusMatrix() {
        LocalDateTime start = LocalDateTime.of(2026, 10, 20, 18, 0);
        LocalDateTime end = start.plusHours(2);
        Session s = Session.builder().startTime(start).endTime(end).status(SessionStatus.UPCOMING).build();

        assertEquals(SessionStatus.UPCOMING, SessionStatusResolver.effective(s, start.minusSeconds(1)));
        assertEquals(SessionStatus.ACTIVE, SessionStatusResolver.effective(s, start));
        assertEquals(SessionStatus.ACTIVE, SessionStatusResolver.effective(s, start.plusMinutes(30)));
        assertEquals(SessionStatus.ACTIVE, SessionStatusResolver.effective(s, end));
        assertEquals(SessionStatus.COMPLETED, SessionStatusResolver.effective(s, end.plusSeconds(1)));

        // Trạng thái lưu cũ (ACTIVE / COMPLETED) không còn ý nghĩa — chỉ giờ quyết định
        s.setStatus(SessionStatus.COMPLETED);
        assertEquals(SessionStatus.UPCOMING, SessionStatusResolver.effective(s, start.minusHours(1)));

        s.setStatus(SessionStatus.CANCELLED);
        assertEquals(SessionStatus.CANCELLED, SessionStatusResolver.effective(s, start.minusHours(1)));
        assertEquals(SessionStatus.CANCELLED, SessionStatusResolver.effective(s, start.plusMinutes(10)));
        assertEquals(SessionStatus.CANCELLED, SessionStatusResolver.effective(s, end.plusDays(1)));
    }

    @Test
    @DisplayName("Chi tiết ca: status = effectiveStatus theo giờ thực")
    void detailStatusEqualsEffective() {
        session.setStatus(SessionStatus.UPCOMING);
        session.setStartTime(LocalDateTime.now().minusMinutes(30));
        session.setEndTime(LocalDateTime.now().plusHours(2));
        SessionResponse r = service.getSessionDetail(5L, null);
        assertEquals(SessionStatus.ACTIVE, r.getEffectiveStatus());
        assertEquals(SessionStatus.ACTIVE, r.getStatus());
    }

    // ---------- 5.5 / 5.6: giá dự kiến + cờ cọc theo người xem ----------

    @Test
    @DisplayName("viewerPricing khớp đúng giá bị tính khi join (thành viên/vãng lai × nam/nữ × có/không giá 2h × full/2h)")
    void viewerPricingEqualsJoinCharge() {
        for (boolean with2h : new boolean[]{false, true}) {
            for (MembershipType type : new MembershipType[]{MembershipType.FIXED, MembershipType.CASUAL}) {
                for (Gender gender : Gender.values()) {
                    for (BigDecimal duration : new BigDecimal[]{null, new BigDecimal("2.0")}) {
                        Session s = Session.builder().id(5L).title("Ca").venue(venue).host(host).maxSlots(10)
                                .startTime(LocalDateTime.now().plusDays(1)).endTime(LocalDateTime.now().plusDays(1).plusHours(4))
                                .memberMalePrice(new BigDecimal("50000")).memberFemalePrice(new BigDecimal("40000"))
                                .guestMalePrice(new BigDecimal("60000")).guestFemalePrice(new BigDecimal("50000"))
                                .build();
                        if (with2h) {
                            s.setMemberMalePrice2h(new BigDecimal("35000"));
                            s.setMemberFemalePrice2h(new BigDecimal("30000"));
                            s.setGuestMalePrice2h(new BigDecimal("45000"));
                            // guestFemalePrice2h để trống → nữ vãng lai không có giá 2h riêng
                        }
                        when(sessionRepository.findById(5L)).thenReturn(Optional.of(s));
                        when(sessionRepository.findByIdWithLock(5L)).thenReturn(Optional.of(s));
                        User viewer = User.builder().id(8L).fullName("V").phone("0900000008").role(Role.MEMBER)
                                .gender(gender).membershipType(type).build();

                        SessionResponse.ViewerPricing pricing = service.getSessionDetail(5L, viewer).getViewerPricing();
                        clearInvocations(participantRepository);
                        JoinSessionRequest req = new JoinSessionRequest();
                        req.setDurationHours(duration);
                        service.memberJoinSession(5L, viewer, req);
                        BigDecimal charged = captureSaved().getBaseFee();

                        String label = type + "/" + gender + "/2h=" + with2h + "/dur=" + duration;
                        assertEquals(type == MembershipType.FIXED, pricing.isMemberTier(), label);
                        BigDecimal expected = (duration != null && pricing.getTwoHourPrice() != null)
                                ? pricing.getTwoHourPrice() : pricing.getFullPrice();
                        assertEquals(0, expected.compareTo(charged), label + " expected " + expected + " charged " + charged);
                        if (!with2h) assertNull(pricing.getTwoHourPrice(), label);
                    }
                }
            }
        }
    }

    @Test
    @DisplayName("Nữ vãng lai khi ca chỉ có giá 2h nam: twoHourPrice = null (tham gia 2h vẫn tính giá full nữ)")
    void femaleGuestWithoutFemale2hPrice() {
        session.setGuestMalePrice2h(new BigDecimal("45000"));
        User viewer = User.builder().id(8L).phone("0900000008").role(Role.MEMBER).gender(Gender.FEMALE)
                .membershipType(MembershipType.CASUAL).build();
        SessionResponse.ViewerPricing p = service.getSessionDetail(5L, viewer).getViewerPricing();
        assertFalse(p.isMemberTier());
        assertEquals(0, new BigDecimal("50000").compareTo(p.getFullPrice()));
        assertNull(p.getTwoHourPrice());
    }

    @Test
    @DisplayName("requiresDeposit: vãng lai lần đầu = true; đã từng đặt = false; thành viên cố định/Host = false; ẩn danh = null")
    void requiresDepositRule() {
        when(participantRepository.countPastBookingsByPhone("0900000007")).thenReturn(0L);
        assertTrue(service.getSessionDetail(5L, member).getRequiresDeposit());

        when(participantRepository.countPastBookingsByPhone("0900000007")).thenReturn(2L);
        assertFalse(service.getSessionDetail(5L, member).getRequiresDeposit());

        User fixed = User.builder().id(9L).phone("0900000009").role(Role.MEMBER).membershipType(MembershipType.FIXED).build();
        when(participantRepository.countPastBookingsByPhone("0900000009")).thenReturn(0L);
        assertFalse(service.getSessionDetail(5L, fixed).getRequiresDeposit());
        assertFalse(service.getSessionDetail(5L, host).getRequiresDeposit());

        SessionResponse anon = service.getSessionDetail(5L, null);
        assertNull(anon.getRequiresDeposit());
        assertNull(anon.getViewerPricing());
    }

    @Test
    @DisplayName("requiresDeposit = true thì join thực sự tạo cọc PENDING đúng depositAmount của ca")
    void requiresDepositMatchesJoin() {
        when(participantRepository.countPastBookingsByPhone("0900000007")).thenReturn(0L);
        assertTrue(service.getSessionDetail(5L, member).getRequiresDeposit());
        service.memberJoinSession(5L, member, new JoinSessionRequest());
        SessionParticipant saved = captureSaved();
        assertEquals(DepositStatus.PENDING, saved.getDepositStatus());
        assertEquals(0, new BigDecimal("30000").compareTo(saved.getDepositAmount()));
    }

    // ---------- 5.12: danh sách ca đếm gộp ----------

    @Test
    @DisplayName("Ca sắp tới: dùng truy vấn lọc endTime > now (không hủy), đếm slot gộp 1 truy vấn, giữ thứ tự repository")
    void upcomingUsesFilteredQueryAndBatchCounts() {
        Session later = Session.builder().id(6L).title("Ca sau").venue(venue).host(host).maxSlots(8)
                .startTime(LocalDateTime.now().plusDays(2)).endTime(LocalDateTime.now().plusDays(2).plusHours(2)).build();
        when(sessionRepository.findUpcomingWithDetails(any())).thenReturn(List.of(session, later));
        List<Object[]> counts = new ArrayList<>();
        counts.add(new Object[]{5L, 3L, 1L});
        when(participantRepository.countSlotsBySessionIds(anyCollection())).thenReturn(counts);

        LocalDateTime before = LocalDateTime.now();
        List<SessionResponse> list = service.getUpcomingSessions(member);

        verify(sessionRepository).findUpcomingWithDetails(argThat(t -> !t.isBefore(before) && !t.isAfter(LocalDateTime.now())));
        assertEquals(List.of(5L, 6L), list.stream().map(SessionResponse::getId).toList());
        assertEquals(3, list.get(0).getBookedSlots());
        assertEquals(1, list.get(0).getCheckedInSlots());
        assertEquals(0, list.get(1).getBookedSlots());
        assertNotNull(list.get(0).getViewerPricing());
        assertEquals(SessionStatus.UPCOMING, list.get(0).getEffectiveStatus());
        verify(participantRepository, never()).countActiveBookedSlots(anyLong());
        verify(participantRepository, never()).countBySessionIdAndCheckinStatus(anyLong(), any());
        verify(participantRepository, times(1)).countPastBookingsByPhone(any());
    }

    // ---------- 5.2: hủy ca ----------

    @Test
    @DisplayName("Hủy ca: đã kết thúc / đã hủy / có người đã thanh toán → 400")
    void cancelRules() {
        session.setStartTime(LocalDateTime.now().minusHours(4));
        session.setEndTime(LocalDateTime.now().minusHours(1));
        assertEquals("Ca đã kết thúc, không thể hủy!",
                assertThrows(RuntimeException.class, () -> service.cancelSession(5L, null, host)).getMessage());

        session.setStartTime(LocalDateTime.now().plusDays(1));
        session.setEndTime(LocalDateTime.now().plusDays(1).plusHours(2));
        session.setStatus(SessionStatus.CANCELLED);
        assertEquals("Ca này đã bị hủy rồi!",
                assertThrows(RuntimeException.class, () -> service.cancelSession(5L, null, host)).getMessage());

        session.setStatus(SessionStatus.UPCOMING);
        SessionParticipant paid = row(1, member);
        paid.setPaymentStatus(PaymentStatus.PAID);
        assertEquals("Ca đã có người thanh toán, vui lòng hoàn tác thu tiền trước khi hủy ca!",
                assertThrows(RuntimeException.class, () -> service.cancelSession(5L, null, host)).getMessage());
        assertEquals(SessionStatus.UPCOMING, session.getStatus());
        verify(sessionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Hủy ca: lưu CANCELLED, cọc PAID → REFUNDED, hoàn voucher, báo Telegram; sau đó chặn join / đặt công khai")
    void cancelRefundsDepositAndVoucher() {
        SessionParticipant withDeposit = row(1, member);
        withDeposit.setDepositStatus(DepositStatus.PAID);
        withDeposit.setDepositAmount(new BigDecimal("30000"));
        User other = User.builder().id(8L).fullName("Bạn <B>").phone("0900000008").build();
        SessionParticipant withVoucher = row(2, other);
        withVoucher.setVoucherRewardId(42L);
        withVoucher.setAdjustmentAmount(new BigDecimal("-6000"));
        withVoucher.setAdjustmentReason("Áp dụng Voucher 10% (Mốc 10 buổi)");
        SessionParticipant pendingDeposit = row(3, host);
        pendingDeposit.setDepositStatus(DepositStatus.PENDING);
        LoyaltyReward reward = LoyaltyReward.builder().id(42L).user(other).milestoneSessions(20).isClaimed(true)
                .claimedAt(LocalDateTime.now()).rewardName("V").build();
        when(loyaltyRewardRepository.findById(42L)).thenReturn(Optional.of(reward));

        SessionResponse res = service.cancelSession(5L, "Sân mất điện", host);

        assertEquals(SessionStatus.CANCELLED, session.getStatus());
        assertEquals(SessionStatus.CANCELLED, res.getStatus());
        assertEquals(SessionStatus.CANCELLED, res.getEffectiveStatus());
        verify(sessionRepository).save(session);
        assertEquals(DepositStatus.REFUNDED, withDeposit.getDepositStatus());
        assertEquals(DepositStatus.PENDING, pendingDeposit.getDepositStatus());
        assertFalse(reward.getIsClaimed());
        assertNull(withVoucher.getVoucherRewardId());
        verify(telegramNotificationService).notifySessionCancelled(eq("Ca tối"), anyString(), eq("Sân mất điện"), eq(3),
                argThat(names -> names.size() == 1 && names.get(0).startsWith("Thành Viên")));

        assertThrows(RuntimeException.class, () -> service.memberJoinSession(5L, member, new JoinSessionRequest()));
        assertThrows(RuntimeException.class, () -> service.bookPublicSlot(5L, booking("0911000111")));
    }

    @Test
    @DisplayName("Lượt bị giữ cọc do vắng (FORFEITED, PAID) không chặn hủy ca")
    void forfeitedRowDoesNotBlockCancel() {
        SessionParticipant forfeited = row(1, member);
        forfeited.setPaymentStatus(PaymentStatus.PAID);
        forfeited.setDepositStatus(DepositStatus.FORFEITED);
        forfeited.setCheckinStatus(CheckinStatus.ABSENT);
        service.cancelSession(5L, null, host);
        assertEquals(SessionStatus.CANCELLED, session.getStatus());
        assertEquals(DepositStatus.FORFEITED, forfeited.getDepositStatus());
    }

    @Test
    @DisplayName("Ca đã hủy: điểm danh / thu tiền / xác nhận cọc bị chặn")
    void cancelledSessionBlocksCheckinAndSettle() {
        session.setStatus(SessionStatus.CANCELLED);
        SessionParticipant p = row(1, member);
        p.setDepositStatus(DepositStatus.PENDING);
        when(participantRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(p));

        CheckinAndPricingService checkin = new CheckinAndPricingService(sessionRepository, participantRepository,
                userRepository, mock(LoyaltyRewardService.class), mock(GeoLocationService.class), telegramNotificationService);
        SettlePaymentRequest settle = new SettlePaymentRequest();
        settle.setParticipantId(1L);
        settle.setPaymentMethod(PaymentMethod.CASH);

        assertThrows(RuntimeException.class, () -> checkin.settlePayment(settle, host));
        assertThrows(RuntimeException.class, () -> checkin.hostCheckinManual(1L));
        assertThrows(RuntimeException.class, () -> checkin.memberCheckin(5L, member, new com.smashflow.dto.CheckinRequest()));
        assertThrows(RuntimeException.class, () -> service.confirmDeposit(1L));
        assertEquals(PaymentStatus.UNPAID, p.getPaymentStatus());
        assertEquals(CheckinStatus.PENDING, p.getCheckinStatus());
        assertEquals(DepositStatus.PENDING, p.getDepositStatus());
    }

    // ---------- 5.3: trùng SĐT / đặt lại sau khi vắng ----------

    @Test
    @DisplayName("Đặt công khai bằng SĐT của tài khoản thành viên / Host → yêu cầu đăng nhập")
    void publicBookingWithMemberPhoneBlocked() {
        when(userRepository.findByPhone("0900000007")).thenReturn(Optional.of(member));
        assertEquals("SĐT này đã có tài khoản thành viên, vui lòng đăng nhập để đăng ký!",
                assertThrows(RuntimeException.class, () -> service.bookPublicSlot(5L, booking("0900000007"))).getMessage());
        when(userRepository.findByPhone("0325000001")).thenReturn(Optional.of(host));
        assertThrows(RuntimeException.class, () -> service.bookPublicSlot(5L, booking("0325000001")));
        verify(participantRepository, never()).save(any());
    }

    @Test
    @DisplayName("Đặt công khai bằng SĐT của tài khoản GUEST có sẵn vẫn được (liên kết user cũ)")
    void publicBookingWithGuestAccountAllowed() {
        User guest = User.builder().id(30L).phone("0911000111").fullName("Khách cũ").role(Role.GUEST).build();
        when(userRepository.findByPhone("0911000111")).thenReturn(Optional.of(guest));
        service.bookPublicSlot(5L, booking("0911000111"));
        assertSame(guest, captureSaved().getUser());
        verify(participantRepository).findBySessionAndUserOrPhone(5L, 30L, "0911000111");
    }

    @Test
    @DisplayName("Đã có lượt (không vắng) theo SĐT → báo đã đăng ký, kể cả khi tìm thấy qua SĐT thay vì user id")
    void duplicateByPhoneOrUser() {
        SessionParticipant existing = row(1, null);
        existing.setGuestPhone("0900000007");
        when(participantRepository.findBySessionAndUserOrPhone(5L, 7L, "0900000007")).thenReturn(List.of(existing));
        assertEquals("Bạn đã tham gia ca này rồi!",
                assertThrows(RuntimeException.class, () -> service.memberJoinSession(5L, member, new JoinSessionRequest())).getMessage());
        verify(participantRepository, never()).save(any());
    }

    @Test
    @DisplayName("Join lại sau khi bị đánh vắng (ABSENT, chưa thanh toán): dùng lại dòng cũ, reset trạng thái, tính lại giá, hoàn voucher cũ")
    void rejoinAfterAbsentReusesRow() {
        SessionParticipant absent = row(1, member);
        absent.setCheckinStatus(CheckinStatus.ABSENT);
        absent.setCheckinAt(LocalDateTime.now().minusHours(1));
        absent.setBaseFee(new BigDecimal("1"));
        absent.setFinalFee(new BigDecimal("1"));
        absent.setVoucherRewardId(42L);
        absent.setAdjustmentAmount(new BigDecimal("-6000"));
        absent.setAdjustmentReason("Áp dụng Voucher 10% (Mốc 10 buổi)");
        LoyaltyReward oldVoucher = LoyaltyReward.builder().id(42L).user(member).milestoneSessions(20).isClaimed(true)
                .claimedAt(LocalDateTime.now()).rewardName("V").build();
        when(loyaltyRewardRepository.findById(42L)).thenReturn(Optional.of(oldVoucher));
        when(participantRepository.findBySessionAndUserOrPhone(5L, 7L, "0900000007")).thenReturn(List.of(absent));
        when(participantRepository.countPastBookingsByPhone("0900000007")).thenReturn(4L);

        service.memberJoinSession(5L, member, new JoinSessionRequest());

        SessionParticipant saved = captureSaved();
        assertSame(absent, saved);
        assertEquals(CheckinStatus.PENDING, saved.getCheckinStatus());
        assertNull(saved.getCheckinAt());
        assertEquals(PaymentStatus.UNPAID, saved.getPaymentStatus());
        assertEquals(0, new BigDecimal("60000").compareTo(saved.getBaseFee()));
        assertEquals(0, new BigDecimal("60000").compareTo(saved.getFinalFee()));
        assertEquals(0, BigDecimal.ZERO.compareTo(saved.getAdjustmentAmount()));
        assertNull(saved.getVoucherRewardId());
        assertEquals(DepositStatus.NONE, saved.getDepositStatus());
        assertFalse(oldVoucher.getIsClaimed());
    }

    @Test
    @DisplayName("Đặt công khai lại sau khi vắng: dùng lại dòng cũ, cọc theo quy tắc lần đầu")
    void publicRebookAfterAbsentReusesRow() {
        User guest = User.builder().id(30L).phone("0911000111").fullName("Khách cũ").role(Role.GUEST).build();
        when(userRepository.findByPhone("0911000111")).thenReturn(Optional.of(guest));
        SessionParticipant absent = row(1, guest);
        absent.setGuestPhone("0911000111");
        absent.setCheckinStatus(CheckinStatus.ABSENT);
        when(participantRepository.findBySessionAndUserOrPhone(5L, 30L, "0911000111")).thenReturn(List.of(absent));
        when(participantRepository.countPastBookingsByPhone("0911000111")).thenReturn(0L);

        service.bookPublicSlot(5L, booking("0911000111"));

        SessionParticipant saved = captureSaved();
        assertSame(absent, saved);
        assertEquals(CheckinStatus.PENDING, saved.getCheckinStatus());
        assertEquals(DepositStatus.PENDING, saved.getDepositStatus());
        assertEquals(0, new BigDecimal("30000").compareTo(saved.getDepositAmount()));
    }

    @Test
    @DisplayName("Lượt cũ bị giữ cọc (FORFEITED) → không cho đặt lại, báo liên hệ Host")
    void forfeitedRejoinBlocked() {
        SessionParticipant forfeited = row(1, member);
        forfeited.setCheckinStatus(CheckinStatus.ABSENT);
        forfeited.setDepositStatus(DepositStatus.FORFEITED);
        forfeited.setPaymentStatus(PaymentStatus.PAID);
        when(participantRepository.findBySessionAndUserOrPhone(5L, 7L, "0900000007")).thenReturn(List.of(forfeited));

        assertEquals("Bạn đã bị giữ cọc ở ca này, vui lòng liên hệ Host!",
                assertThrows(RuntimeException.class, () -> service.memberJoinSession(5L, member, new JoinSessionRequest())).getMessage());
        verify(participantRepository, never()).save(any());
    }

    @Test
    @DisplayName("Tra lượt theo (ca, user) không ném lỗi khi dữ liệu cũ bị trùng: ưu tiên dòng không vắng")
    void duplicateSafeLookup() {
        SessionParticipant absent = SessionParticipant.builder().id(1L).checkinStatus(CheckinStatus.ABSENT).build();
        SessionParticipant active = SessionParticipant.builder().id(2L).checkinStatus(CheckinStatus.PENDING).build();
        SessionParticipant absent2 = SessionParticipant.builder().id(3L).checkinStatus(CheckinStatus.ABSENT).build();

        assertSame(active, SessionParticipantRepository.preferActive(List.of(absent, active)).orElseThrow());
        assertSame(absent, SessionParticipantRepository.preferActive(List.of(absent, absent2)).orElseThrow());
        assertTrue(SessionParticipantRepository.preferActive(List.of()).isEmpty());
    }

    // ---------- 5.4: sửa địa điểm ----------

    private UpdateSessionRequest venueEdit(String name, String address) {
        UpdateSessionRequest r = new UpdateSessionRequest();
        r.setTitle("Ca tối");
        r.setVenueName(name);
        r.setVenueAddress(address);
        return r;
    }

    @Test
    @DisplayName("Sửa địa điểm ca dùng chung venue: tạo venue mới, venue cũ (của ca khác) giữ nguyên")
    void venueEditDoesNotMutateSharedVenue() {
        when(sessionRepository.countByVenueIdAndIdNot(1L, 5L)).thenReturn(3L);
        when(venueRepository.findFirstByNameIgnoreCaseAndAddressIgnoreCaseOrderByIdAsc(any(), any())).thenReturn(Optional.empty());

        service.updateSession(5L, venueEdit("Sân B", "Q1"));

        assertEquals("Sân A", venue.getName());
        assertEquals("Q7", venue.getAddress());
        assertNotSame(venue, session.getVenue());
        assertEquals("Sân B", session.getVenue().getName());
        assertEquals("Q1", session.getVenue().getAddress());
        assertEquals(0, new BigDecimal("10.1").compareTo(session.getVenue().getLatitude()));
    }

    @Test
    @DisplayName("Sửa địa điểm trùng tên + địa chỉ venue có sẵn → dùng lại venue đó")
    void venueEditReusesExistingVenue() {
        Venue existing = Venue.builder().id(2L).name("Sân B").address("Q1").build();
        when(sessionRepository.countByVenueIdAndIdNot(1L, 5L)).thenReturn(3L);
        when(venueRepository.findFirstByNameIgnoreCaseAndAddressIgnoreCaseOrderByIdAsc("Sân B", "Q1")).thenReturn(Optional.of(existing));

        service.updateSession(5L, venueEdit("Sân B", "Q1"));

        assertSame(existing, session.getVenue());
        assertEquals("Sân A", venue.getName());
        verify(venueRepository, never()).save(any());
    }

    @Test
    @DisplayName("Venue chỉ ca này dùng → sửa trực tiếp venue đó")
    void venueEditMutatesUnsharedVenue() {
        when(sessionRepository.countByVenueIdAndIdNot(1L, 5L)).thenReturn(0L);
        when(venueRepository.findFirstByNameIgnoreCaseAndAddressIgnoreCaseOrderByIdAsc(any(), any())).thenReturn(Optional.empty());

        service.updateSession(5L, venueEdit("Sân A mới", null));

        assertSame(venue, session.getVenue());
        assertEquals("Sân A mới", venue.getName());
        assertEquals("Q7", venue.getAddress());
    }

    // ---------- 5.5: xóa giá 2h ----------

    @Test
    @DisplayName("clearTwoHourPrices: xóa cả 4 giá 2h, lượt chưa thanh toán gói 2h tính lại về giá full ca")
    void clearTwoHourPrices() {
        session.setMemberMalePrice2h(new BigDecimal("35000"));
        session.setMemberFemalePrice2h(new BigDecimal("30000"));
        session.setGuestMalePrice2h(new BigDecimal("45000"));
        session.setGuestFemalePrice2h(new BigDecimal("40000"));
        SessionParticipant twoHour = row(1, member);
        twoHour.setDurationHours(new BigDecimal("2.0"));
        twoHour.setBaseFee(new BigDecimal("45000"));
        twoHour.setFinalFee(new BigDecimal("45000"));
        SessionParticipant paid = row(2, member);
        paid.setDurationHours(new BigDecimal("2.0"));
        paid.setBaseFee(new BigDecimal("45000"));
        paid.setFinalFee(new BigDecimal("45000"));
        paid.setPaymentStatus(PaymentStatus.PAID);

        UpdateSessionRequest r = new UpdateSessionRequest();
        r.setTitle("Ca tối");
        r.setGuestMalePrice2h(new BigDecimal("1")); // bị bỏ qua khi xóa
        r.setClearTwoHourPrices(true);
        SessionResponse res = service.updateSession(5L, r);

        assertNull(session.getMemberMalePrice2h());
        assertNull(session.getMemberFemalePrice2h());
        assertNull(session.getGuestMalePrice2h());
        assertNull(session.getGuestFemalePrice2h());
        assertNull(res.getGuestMalePrice2h());
        assertEquals(0, new BigDecimal("60000").compareTo(twoHour.getFinalFee()));
        assertEquals(0, new BigDecimal("45000").compareTo(paid.getFinalFee()));
    }

    @Test
    @DisplayName("clearTwoHourPrices khi ca vốn không có giá 2h → không tính lại ai")
    void clearTwoHourPricesNoopWhenNone() {
        row(1, member);
        UpdateSessionRequest r = new UpdateSessionRequest();
        r.setTitle("Ca tối");
        r.setClearTwoHourPrices(true);
        service.updateSession(5L, r);
        verify(participantRepository, never()).findBySessionId(5L);
    }
}
