package com.smashflow.service;

import com.smashflow.dto.ParticipantResponse;
import com.smashflow.dto.SessionResponse;
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
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SessionPrivacyTest {

    @Mock private SessionRepository sessionRepository;
    @Mock private SessionParticipantRepository participantRepository;
    @Mock private VenueRepository venueRepository;
    @Mock private UserRepository userRepository;
    @Mock private VietQrService vietQrService;
    @Mock private TelegramNotificationService telegramNotificationService;
    @Mock private LoyaltyRewardRepository loyaltyRewardRepository;
    @InjectMocks private SessionService service;

    private User host;
    private User owner;
    private User other;
    private Session session;
    private SessionParticipant ownerBooking;
    private SessionParticipant otherBooking;
    private SessionParticipant walkInGuest;

    @BeforeEach
    void setUp() {
        host = User.builder().id(1L).phone("0325000001").fullName("Host").role(Role.HOST).build();
        owner = User.builder().id(2L).phone("0912345678").fullName("Chủ Lượt").role(Role.MEMBER).build();
        other = User.builder().id(3L).phone("0987654321").fullName("Người Khác").role(Role.MEMBER).build();
        Venue venue = Venue.builder().id(1L).name("Sân A").address("Q7").build();
        session = Session.builder().id(77L).title("Ca tối").venue(venue).host(host)
                .startTime(LocalDateTime.now().plusDays(1)).endTime(LocalDateTime.now().plusDays(1).plusHours(2))
                .build();

        ownerBooking = SessionParticipant.builder().id(12L).session(session).user(owner).isGuest(true)
                .depositStatus(DepositStatus.PENDING).depositAmount(new BigDecimal("20000"))
                .baseFee(new BigDecimal("60000")).finalFee(new BigDecimal("60000")).build();
        otherBooking = SessionParticipant.builder().id(13L).session(session).user(other).isGuest(false)
                .baseFee(new BigDecimal("50000")).finalFee(new BigDecimal("50000")).build();
        // Khách đặt công khai: user GUEST tự tạo, SĐT nằm ở guestPhone
        User guestUser = User.builder().id(4L).phone("0355555777").fullName("").role(Role.GUEST).build();
        walkInGuest = SessionParticipant.builder().id(14L).session(session).user(guestUser).isGuest(true)
                .guestName("Khách").guestPhone("0355555777")
                .baseFee(new BigDecimal("60000")).finalFee(new BigDecimal("60000")).build();

        when(participantRepository.findById(12L)).thenReturn(Optional.of(ownerBooking));
        when(sessionRepository.findById(77L)).thenReturn(Optional.of(session));
        when(participantRepository.findBySessionIdWithDetails(77L)).thenReturn(List.of(ownerBooking, otherBooking, walkInGuest));
        when(participantRepository.countActiveBookedSlots(anyLong())).thenReturn(3L);
        when(participantRepository.countBySessionIdAndCheckinStatus(anyLong(), any())).thenReturn(0L);
        when(vietQrService.generateQrUrl(any(), any())).thenReturn("https://qr.example/x");
    }

    // ---------- 1.4 Quyền xem QR ----------

    @Test
    @DisplayName("Chủ lượt đăng ký xem được QR cọc + QR thanh toán")
    void ownerCanGetQr() {
        assertEquals("https://qr.example/x", service.getDepositQrUrl(12L, owner));
        assertEquals("https://qr.example/x", service.getFinalPaymentQrUrl(12L, owner));
    }

    @Test
    @DisplayName("Thành viên khác bị chặn (403), không sinh QR")
    void otherMemberForbidden() {
        assertThrows(AccessDeniedException.class, () -> service.getDepositQrUrl(12L, other));
        assertThrows(AccessDeniedException.class, () -> service.getFinalPaymentQrUrl(12L, other));
        verify(vietQrService, never()).generateQrUrl(any(), any());
    }

    @Test
    @DisplayName("Chưa đăng nhập bị chặn")
    void anonymousForbidden() {
        assertThrows(AccessDeniedException.class, () -> service.getDepositQrUrl(12L, null));
        verify(participantRepository, never()).findById(anyLong());
    }

    @Test
    @DisplayName("Host xem được QR của mọi người")
    void hostCanGetQr() {
        assertNotNull(service.getDepositQrUrl(12L, host));
        assertNotNull(service.getFinalPaymentQrUrl(12L, host));
    }

    @Test
    @DisplayName("Nội dung CK: cọc = 'COC SF<id>', thanh toán = 'SF<id>', không chứa SĐT, không còn 'null'")
    void memoUsesParticipantCode() {
        ArgumentCaptor<String> memo = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<BigDecimal> amount = ArgumentCaptor.forClass(BigDecimal.class);

        service.getDepositQrUrl(12L, owner);
        service.getFinalPaymentQrUrl(12L, owner);
        verify(vietQrService, times(2)).generateQrUrl(amount.capture(), memo.capture());

        assertEquals("COC SF12", memo.getAllValues().get(0));
        assertEquals("SF12", memo.getAllValues().get(1));
        for (String m : memo.getAllValues()) {
            assertFalse(m.contains(owner.getPhone()));
            assertFalse(m.contains("null"));
            assertTrue(m.matches("[A-Z0-9 ]{1,25}"), "Memo ASCII ngắn: " + m);
        }
        assertEquals(0, new BigDecimal("20000").compareTo(amount.getAllValues().get(0)));
        assertEquals(0, new BigDecimal("40000").compareTo(amount.getAllValues().get(1)));
    }

    // ---------- 1.5 Che SĐT ----------

    private Map<Long, String> phonesSeenBy(User viewer) {
        SessionResponse res = service.getSessionDetail(77L, viewer);
        return res.getParticipants().stream().collect(Collectors.toMap(ParticipantResponse::getId, ParticipantResponse::getPhone));
    }

    @Test
    @DisplayName("Thành viên thường: SĐT của mình đầy đủ, của người khác bị che 0987***321")
    void memberSeesOwnPhoneOnly() {
        Map<Long, String> phones = phonesSeenBy(owner);
        assertEquals("0912345678", phones.get(12L));
        assertEquals("0987***321", phones.get(13L));
        assertEquals("0355***777", phones.get(14L));
    }

    @Test
    @DisplayName("Host thấy đầy đủ SĐT mọi người")
    void hostSeesAllPhones() {
        Map<Long, String> phones = phonesSeenBy(host);
        assertEquals("0912345678", phones.get(12L));
        assertEquals("0987654321", phones.get(13L));
        assertEquals("0355555777", phones.get(14L));
    }

    @Test
    @DisplayName("Khách chưa đăng nhập thấy toàn bộ SĐT bị che")
    void anonymousSeesMaskedPhones() {
        Map<Long, String> phones = phonesSeenBy(null);
        assertTrue(phones.values().stream().allMatch(p -> p.contains("***")), phones.toString());
    }

    @Test
    @DisplayName("PhoneMasking: định dạng 0912***678, chuỗi ngắn che hết, null giữ nguyên")
    void maskFormat() {
        assertEquals("0912***678", PhoneMasking.mask("0912345678"));
        assertEquals("***", PhoneMasking.mask("12345"));
        assertNull(PhoneMasking.mask(null));
        assertEquals("N/A", PhoneMasking.mask("N/A"));
    }
}
