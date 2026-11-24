package com.smashflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smashflow.dto.SepayWebhookPayload;
import com.smashflow.dto.SepayWebhookResponse;
import com.smashflow.model.*;
import com.smashflow.repository.SepayWebhookEventRepository;
import com.smashflow.repository.SessionParticipantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SepayWebhookServiceTest {

    @Mock
    private SepayWebhookEventRepository eventRepository;

    @Mock
    private SessionParticipantRepository participantRepository;

    @Mock
    private TelegramNotificationService telegramService;

    private SepayWebhookService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final String VALID_API_KEY = "my_secret_sepay_api_key_123";

    @BeforeEach
    void setUp() {
        service = new SepayWebhookService(eventRepository, participantRepository, telegramService, objectMapper);
        ReflectionTestUtils.setField(service, "apiKey", VALID_API_KEY);
        ReflectionTestUtils.setField(service, "webhookSecret", "");
        ReflectionTestUtils.setField(service, "ipCheckEnabled", false);
        ReflectionTestUtils.setField(service, "sepayBaseUrl", "https://my.sepay.vn");
    }

    @Nested
    @DisplayName("1. Kiểm tra xác thực Authorization Header")
    class AuthorizationTests {

        @Test
        @DisplayName("Hợp lệ: Header dạng 'Apikey <KEY>'")
        void validApiKeyHeader() {
            assertDoesNotThrow(() -> service.validateAuthorization("Apikey " + VALID_API_KEY));
        }

        @Test
        @DisplayName("Hợp lệ: Header dạng 'Bearer <KEY>'")
        void validBearerHeader() {
            assertDoesNotThrow(() -> service.validateAuthorization("Bearer " + VALID_API_KEY));
        }

        @Test
        @DisplayName("Hợp lệ: Dùng secret webhook riêng (WEBHOOK_BANK_SECRET)")
        void validWebhookSecret() {
            ReflectionTestUtils.setField(service, "webhookSecret", "custom_bank_secret_999");
            assertDoesNotThrow(() -> service.validateAuthorization("Apikey custom_bank_secret_999"));
        }

        @Test
        @DisplayName("Lỗi 401: Thiếu Authorization header")
        void missingHeaderThrows401() {
            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> service.validateAuthorization(null));
            assertEquals(401, ex.getStatusCode().value());
        }

        @Test
        @DisplayName("Lỗi 401: Sai key trong header")
        void invalidKeyThrows401() {
            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> service.validateAuthorization("Apikey wrong_key_here"));
            assertEquals(401, ex.getStatusCode().value());
        }

        @Test
        @DisplayName("Lỗi 503: Server chưa cấu hình SEPAY_API_KEY")
        void unconfiguredKeyThrows503() {
            ReflectionTestUtils.setField(service, "apiKey", "");
            ReflectionTestUtils.setField(service, "webhookSecret", "");
            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> service.validateAuthorization("Apikey any_key"));
            assertEquals(503, ex.getStatusCode().value());
        }
    }

    @Nested
    @DisplayName("2. Kiểm tra xử lý Webhook Payload & Idempotency")
    class WebhookProcessingTests {

        @Test
        @DisplayName("Chống trùng lặp: Giao dịch đã tồn tại ID thì trả về thành công ngay, không trừ/cộng lại")
        void idempotentDuplicateTransaction() {
            when(eventRepository.existsBySepayTransactionId(99999L)).thenReturn(true);

            SepayWebhookPayload payload = SepayWebhookPayload.builder()
                    .id(99999L)
                    .content("SF101")
                    .transferAmount(new BigDecimal("50000"))
                    .transferType("in")
                    .build();

            SepayWebhookResponse res = service.processWebhook(payload, "{}");

            assertTrue(res.isSuccess());
            assertTrue(res.isMatched());
            verify(participantRepository, never()).findByIdForUpdate(any());
        }

        @Test
        @DisplayName("Bỏ qua giao dịch chuyển tiền ra (transferType = out)")
        void ignoreTransferOut() {
            when(eventRepository.existsBySepayTransactionId(12345L)).thenReturn(false);

            SepayWebhookPayload payload = SepayWebhookPayload.builder()
                    .id(12345L)
                    .content("SF101")
                    .transferAmount(new BigDecimal("50000"))
                    .transferType("out")
                    .build();

            SepayWebhookResponse res = service.processWebhook(payload, "{}");

            assertTrue(res.isSuccess());
            assertFalse(res.isMatched());
            verify(participantRepository, never()).findByIdForUpdate(any());
            verify(eventRepository).save(any());
        }

        @Test
        @DisplayName("Tự động duyệt cọc: Nhận cú pháp 'COC SF101' với số tiền đủ cọc")
        void autoConfirmDeposit() {
            Long participantId = 101L;
            SessionParticipant participant = SessionParticipant.builder()
                    .id(participantId)
                    .isGuest(true)
                    .guestName("Nguyễn Văn Khách")
                    .depositAmount(new BigDecimal("20000"))
                    .depositStatus(DepositStatus.PENDING)
                    .build();

            when(eventRepository.existsBySepayTransactionId(8881L)).thenReturn(false);
            when(participantRepository.findByIdForUpdate(participantId)).thenReturn(Optional.of(participant));

            SepayWebhookPayload payload = SepayWebhookPayload.builder()
                    .id(8881L)
                    .gateway("MBBank")
                    .content("COC SF101 chuyen tien coc")
                    .transferType("in")
                    .transferAmount(new BigDecimal("20000"))
                    .build();

            SepayWebhookResponse res = service.processWebhook(payload, "{}");

            assertTrue(res.isSuccess());
            assertTrue(res.isMatched());
            assertEquals("DEPOSIT", res.getPaymentType());
            assertEquals(DepositStatus.PAID, participant.getDepositStatus());
            assertEquals(PaymentMethod.VIETQR, participant.getPaymentMethod());

            verify(participantRepository).save(participant);
            verify(telegramService).sendNotification(contains("Đã nhận cọc VietQR"));
        }

        @Test
        @DisplayName("Tự động duyệt cọc kể cả khi viết hoa/thường hoặc dính chữ 'coc sf 101'")
        void autoConfirmsDepositCaseInsensitiveAndLoose() {
            Long participantId = 101L;
            SessionParticipant participant = SessionParticipant.builder()
                    .id(participantId)
                    .isGuest(true)
                    .guestName("Khách Thử Nghiệm")
                    .depositAmount(new BigDecimal("50000"))
                    .depositStatus(DepositStatus.PENDING)
                    .build();

            when(eventRepository.existsBySepayTransactionId(8889L)).thenReturn(false);
            when(participantRepository.findByIdForUpdate(participantId)).thenReturn(Optional.of(participant));

            SepayWebhookPayload payload = SepayWebhookPayload.builder()
                    .id(8889L)
                    .transferType("in")
                    .transferAmount(new BigDecimal("50000"))
                    .content("MBVCB.999.coc sf 101 ck")
                    .build();

            SepayWebhookResponse res = service.processWebhook(payload);

            assertTrue(res.isSuccess());
            assertEquals(DepositStatus.PAID, participant.getDepositStatus());
        }

        @Test
        @DisplayName("Tự động thanh toán tiền sân: Nhận cú pháp 'SF101' với số tiền đủ tiền sân")
        void autoConfirmFinalPayment() {
            Long participantId = 101L;
            SessionParticipant participant = SessionParticipant.builder()
                    .id(participantId)
                    .isGuest(false)
                    .user(User.builder().id(7L).fullName("Phạm Anh Đức").build())
                    .finalFee(new BigDecimal("50000"))
                    .depositAmount(BigDecimal.ZERO)
                    .paymentStatus(PaymentStatus.UNPAID)
                    .build();

            when(eventRepository.existsBySepayTransactionId(8882L)).thenReturn(false);
            when(participantRepository.findByIdForUpdate(participantId)).thenReturn(Optional.of(participant));

            SepayWebhookPayload payload = SepayWebhookPayload.builder()
                    .id(8882L)
                    .gateway("Vietcombank")
                    .content("SF101 thanh toan tien san cau long")
                    .transferType("in")
                    .transferAmount(new BigDecimal("50000"))
                    .build();

            SepayWebhookResponse res = service.processWebhook(payload, "{}");

            assertTrue(res.isSuccess());
            assertTrue(res.isMatched());
            assertEquals("FINAL_PAYMENT", res.getPaymentType());
            assertEquals(PaymentStatus.PAID, participant.getPaymentStatus());
            assertEquals(PaymentMethod.VIETQR, participant.getPaymentMethod());
            assertNotNull(participant.getPaidAt());

            verify(participantRepository).save(participant);
            verify(telegramService).sendNotification(contains("Đã nhận thanh toán tiền sân VietQR"));
        }

        @Test
        @DisplayName("Không khớp: Thiếu tiền thanh toán -> không duyệt, ghi lỗi vào log")
        void insufficientAmountNotConfirmed() {
            Long participantId = 101L;
            SessionParticipant participant = SessionParticipant.builder()
                    .id(participantId)
                    .isGuest(true)
                    .guestName("Khách Thiếu Tiền")
                    .finalFee(new BigDecimal("60000"))
                    .depositAmount(BigDecimal.ZERO)
                    .paymentStatus(PaymentStatus.UNPAID)
                    .build();

            when(eventRepository.existsBySepayTransactionId(8883L)).thenReturn(false);
            when(participantRepository.findByIdForUpdate(participantId)).thenReturn(Optional.of(participant));

            SepayWebhookPayload payload = SepayWebhookPayload.builder()
                    .id(8883L)
                    .content("SF101")
                    .transferType("in")
                    .transferAmount(new BigDecimal("20000")) // Chỉ chuyển 20k trong khi cần 60k
                    .build();

            SepayWebhookResponse res = service.processWebhook(payload, "{}");

            assertFalse(res.isSuccess());
            assertFalse(res.isMatched()); // Không khớp vì thiếu tiền
            assertEquals(PaymentStatus.UNPAID, participant.getPaymentStatus()); // Vẫn UNPAID

            ArgumentCaptor<SepayWebhookEvent> captor = ArgumentCaptor.forClass(SepayWebhookEvent.class);
            verify(eventRepository).save(captor.capture());
            assertFalse(captor.getValue().getMatched());
            assertTrue(captor.getValue().getErrorMessage().contains("nhỏ hơn tiền sân"));
        }

        @Test
        @DisplayName("Không khớp: Nội dung chuyển khoản lung tung không có mã SF")
        void randomContentNotMatched() {
            when(eventRepository.existsBySepayTransactionId(8884L)).thenReturn(false);

            SepayWebhookPayload payload = SepayWebhookPayload.builder()
                    .id(8884L)
                    .content("Nguyen Van A chuyen tien mua vot cau long")
                    .transferType("in")
                    .transferAmount(new BigDecimal("100000"))
                    .build();

            SepayWebhookResponse res = service.processWebhook(payload, "{}");

            assertTrue(res.isSuccess());
            assertFalse(res.isMatched());
            verify(participantRepository, never()).findByIdForUpdate(any());
        }

        @Test
        @DisplayName("Cảnh báo và không duyệt cọc nếu khách chuyển thiếu tiền")
        void depositUnderpaidTriggersAlert() {
            Long participantId = 101L;
            SessionParticipant participant = SessionParticipant.builder()
                    .id(participantId)
                    .isGuest(true)
                    .guestName("Khách Thiếu Tiền Cọc")
                    .depositAmount(new BigDecimal("50000"))
                    .depositStatus(DepositStatus.PENDING)
                    .build();

            when(eventRepository.existsBySepayTransactionId(8885L)).thenReturn(false);
            when(participantRepository.findByIdForUpdate(participantId)).thenReturn(Optional.of(participant));

            SepayWebhookPayload payload = SepayWebhookPayload.builder()
                    .id(8885L)
                    .transferType("in")
                    .transferAmount(new BigDecimal("20000")) // Cần 50k nhưng chuyển 20k
                    .content("COC SF101 chuyen thieu")
                    .build();

            SepayWebhookResponse res = service.processWebhook(payload);

            assertFalse(res.isSuccess());
            assertEquals("Transfer amount is less than required deposit", res.getMessage());
            assertEquals(DepositStatus.PENDING, participant.getDepositStatus());
            verify(participantRepository, never()).save(any());
            verify(telegramService).sendNotification(contains("CẢNH BÁO THIẾU TIỀN CỌC"));
        }

        @Test
        @DisplayName("Nhận tiền cho ca đã bị hủy thì cảnh báo và không duyệt")
        void cancelledSessionWarnsHost() {
            Long participantId = 101L;
            Session session = Session.builder()
                    .id(1L)
                    .title("Ca Thứ 7 Sân 1-2")
                    .status(SessionStatus.CANCELLED)
                    .depositAmount(new BigDecimal("50000"))
                    .build();

            SessionParticipant participant = SessionParticipant.builder()
                    .id(participantId)
                    .session(session)
                    .isGuest(true)
                    .guestName("Khách Đặt Sân")
                    .depositAmount(new BigDecimal("50000"))
                    .depositStatus(DepositStatus.PENDING)
                    .build();

            when(eventRepository.existsBySepayTransactionId(8886L)).thenReturn(false);
            when(participantRepository.findByIdForUpdate(participantId)).thenReturn(Optional.of(participant));

            SepayWebhookPayload payload = SepayWebhookPayload.builder()
                    .id(8886L)
                    .transferType("in")
                    .transferAmount(new BigDecimal("50000"))
                    .content("COC SF101")
                    .build();

            SepayWebhookResponse res = service.processWebhook(payload);

            assertTrue(res.isSuccess());
            assertEquals("Session is cancelled", res.getMessage());
            assertEquals(DepositStatus.PENDING, participant.getDepositStatus());
            verify(telegramService).sendNotification(contains("Nhận tiền cọc ca đã hủy"));
        }
    }
}
