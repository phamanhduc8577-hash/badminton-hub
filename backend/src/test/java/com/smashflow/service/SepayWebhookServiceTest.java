package com.smashflow.service;

import com.smashflow.dto.SepayWebhookPayload;
import com.smashflow.dto.SepayWebhookResponse;
import com.smashflow.model.DepositStatus;
import com.smashflow.model.PaymentMethod;
import com.smashflow.model.PaymentStatus;
import com.smashflow.model.Role;
import com.smashflow.model.Session;
import com.smashflow.model.SessionParticipant;
import com.smashflow.model.SessionStatus;
import com.smashflow.model.User;
import com.smashflow.repository.SessionParticipantRepository;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SepayWebhookServiceTest {

    @Mock
    private SessionParticipantRepository participantRepository;

    @Mock
    private TelegramNotificationService telegramNotificationService;

    @InjectMocks
    private SepayWebhookService service;

    private Session session;
    private SessionParticipant participant;
    private User member;

    @BeforeEach
    void setUp() {
        session = Session.builder()
                .id(1L)
                .title("Ca Thứ 7 Sân 1-2")
                .status(SessionStatus.UPCOMING)
                .depositAmount(new BigDecimal("50000"))
                .build();

        member = User.builder()
                .id(10L)
                .fullName("Nguyễn Văn A")
                .phone("0912345678")
                .role(Role.MEMBER)
                .build();

        participant = SessionParticipant.builder()
                .id(101L)
                .session(session)
                .user(member)
                .depositStatus(DepositStatus.PENDING)
                .depositAmount(new BigDecimal("50000"))
                .finalFee(new BigDecimal("90000"))
                .paymentStatus(PaymentStatus.UNPAID)
                .build();

        when(participantRepository.findByIdForUpdate(101L)).thenReturn(Optional.of(participant));
    }

    @Test
    @DisplayName("Bỏ qua giao dịch chuyển tiền đi (transferType = out)")
    void ignoresOutgoingTransfer() {
        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(1L)
                .transferType("out")
                .transferAmount(new BigDecimal("50000"))
                .content("COC SF101")
                .build();

        SepayWebhookResponse res = service.processWebhook(payload);
        assertTrue(res.isSuccess());
        verify(participantRepository, never()).save(any());
    }

    @Test
    @DisplayName("Tự động duyệt cọc khi cú pháp 'COC SF101' và chuyển đủ 50.000đ")
    void autoConfirmsDepositSuccess() {
        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(2L)
                .transferType("in")
                .transferAmount(new BigDecimal("50000"))
                .content("COC SF101 NGUYEN VAN A COC TIEN")
                .gateway("MBBank")
                .referenceCode("REF123")
                .build();

        SepayWebhookResponse res = service.processWebhook(payload);

        assertTrue(res.isSuccess());
        assertEquals("Deposit confirmed successfully", res.getMessage());
        assertEquals(DepositStatus.PAID, participant.getDepositStatus());
        verify(participantRepository).save(participant);
        verify(telegramNotificationService, atLeastOnce()).sendNotification(anyString());
    }

    @Test
    @DisplayName("Tự động duyệt cọc kể cả khi viết hoa/thường hoặc dính chữ 'coc sf 101'")
    void autoConfirmsDepositCaseInsensitiveAndLoose() {
        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(3L)
                .transferType("in")
                .transferAmount(new BigDecimal("50000"))
                .content("MBVCB.999.coc sf 101 ck")
                .build();

        SepayWebhookResponse res = service.processWebhook(payload);

        assertTrue(res.isSuccess());
        assertEquals(DepositStatus.PAID, participant.getDepositStatus());
    }

    @Test
    @DisplayName("Idempotent: Cọc đã duyệt rồi (PAID) thì không xử lý lại, trả về thành công")
    void depositAlreadyConfirmedIdempotent() {
        participant.setDepositStatus(DepositStatus.PAID);

        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(4L)
                .transferType("in")
                .transferAmount(new BigDecimal("50000"))
                .content("COC SF101")
                .build();

        SepayWebhookResponse res = service.processWebhook(payload);

        assertTrue(res.isSuccess());
        assertEquals("Deposit already confirmed", res.getMessage());
        verify(participantRepository, never()).save(any());
    }

    @Test
    @DisplayName("Cảnh báo và không duyệt cọc nếu khách chuyển thiếu tiền")
    void depositUnderpaidTriggersAlert() {
        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(5L)
                .transferType("in")
                .transferAmount(new BigDecimal("20000")) // Cần 50k nhưng chuyển 20k
                .content("COC SF101 chuyen thieu")
                .build();

        SepayWebhookResponse res = service.processWebhook(payload);

        assertFalse(res.isSuccess());
        assertEquals("Transfer amount is less than required deposit", res.getMessage());
        assertEquals(DepositStatus.PENDING, participant.getDepositStatus()); // Vẫn PENDING
        verify(participantRepository, never()).save(any());
        verify(telegramNotificationService).sendNotification(contains("CẢNH BÁO THIẾU TIỀN CỌC"));
    }

    @Test
    @DisplayName("Tự động thu tiền sân khi cú pháp 'SF101' và chuyển đủ tiền còn lại")
    void autoSettlesFinalPaymentSuccess() {
        // Cọc đã nhận 50k, tổng bill 90k -> còn lại 40k
        participant.setDepositStatus(DepositStatus.PAID);

        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(6L)
                .transferType("in")
                .transferAmount(new BigDecimal("40000"))
                .content("SF101 THANH TOAN TIEN SAN")
                .gateway("Vietcombank")
                .referenceCode("VCB999")
                .build();

        SepayWebhookResponse res = service.processWebhook(payload);

        assertTrue(res.isSuccess());
        assertEquals("Payment settled successfully", res.getMessage());
        assertEquals(PaymentStatus.PAID, participant.getPaymentStatus());
        assertEquals(PaymentMethod.VIETQR, participant.getPaymentMethod());
        assertNotNull(participant.getPaidAt());
        verify(participantRepository).save(participant);
        verify(telegramNotificationService, atLeastOnce()).sendNotification(contains("TỰ ĐỘNG THU TIỀN SÂN"));
    }

    @Test
    @DisplayName("Idempotent: Tiền sân đã thu rồi (PAID) thì không thu lại, trả về thành công")
    void finalPaymentAlreadySettledIdempotent() {
        participant.setPaymentStatus(PaymentStatus.PAID);

        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(7L)
                .transferType("in")
                .transferAmount(new BigDecimal("40000"))
                .content("SF101")
                .build();

        SepayWebhookResponse res = service.processWebhook(payload);

        assertTrue(res.isSuccess());
        assertEquals("Payment already settled", res.getMessage());
        verify(participantRepository, never()).save(any());
    }

    @Test
    @DisplayName("Cảnh báo và không chốt thu tiền nếu khách chuyển thiếu tiền sân")
    void finalPaymentUnderpaidTriggersAlert() {
        participant.setDepositStatus(DepositStatus.PAID); // Còn lại 40k

        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(8L)
                .transferType("in")
                .transferAmount(new BigDecimal("30000")) // Chuyển thiếu 10k
                .content("SF101")
                .build();

        SepayWebhookResponse res = service.processWebhook(payload);

        assertFalse(res.isSuccess());
        assertEquals("Transfer amount is less than remaining bill", res.getMessage());
        assertEquals(PaymentStatus.UNPAID, participant.getPaymentStatus());
        verify(participantRepository, never()).save(any());
        verify(telegramNotificationService).sendNotification(contains("CẢNH BÁO THIẾU TIỀN SÂN"));
    }

    @Test
    @DisplayName("Giao dịch không chứa mã SmashFlow trả về 200 OK để SePay không retry phiền toái")
    void unrelatedMemoIgnoredGracefully() {
        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(9L)
                .transferType("in")
                .transferAmount(new BigDecimal("100000"))
                .content("Tra tien com trua")
                .build();

        SepayWebhookResponse res = service.processWebhook(payload);

        assertTrue(res.isSuccess());
        assertEquals("No matching payment code in transaction content", res.getMessage());
        verify(participantRepository, never()).save(any());
    }

    @Test
    @DisplayName("Nhận tiền cho ca đã bị hủy thì cảnh báo Host và không duyệt")
    void cancelledSessionWarnsHost() {
        session.setStatus(SessionStatus.CANCELLED);

        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(10L)
                .transferType("in")
                .transferAmount(new BigDecimal("50000"))
                .content("COC SF101")
                .build();

        SepayWebhookResponse res = service.processWebhook(payload);

        assertTrue(res.isSuccess());
        assertEquals("Session is cancelled", res.getMessage());
        assertEquals(DepositStatus.PENDING, participant.getDepositStatus());
        verify(telegramNotificationService).sendNotification(contains("Nhận tiền cọc ca đã hủy"));
    }
}
