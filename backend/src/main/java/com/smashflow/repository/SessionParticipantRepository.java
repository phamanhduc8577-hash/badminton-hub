package com.smashflow.repository;

import com.smashflow.model.CheckinStatus;
import com.smashflow.model.SessionParticipant;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface SessionParticipantRepository extends JpaRepository<SessionParticipant, Long> {
    /** Khóa dòng người tham gia khi Host duyệt / hủy điểm danh, tránh bấm đúp cộng dư buổi. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT sp FROM SessionParticipant sp WHERE sp.id = :id")
    Optional<SessionParticipant> findByIdForUpdate(@Param("id") Long id);

    /** Số buổi thực tế = số ca khác nhau mà thành viên đã được điểm danh (cùng cách tính với DataInitializer). */
    @Query("SELECT COUNT(DISTINCT sp.session.id) FROM SessionParticipant sp WHERE sp.user.id = :userId AND sp.checkinStatus = com.smashflow.model.CheckinStatus.CHECKED_IN")
    long countDistinctCheckedInSessions(@Param("userId") Long userId);

    List<SessionParticipant> findBySessionId(Long sessionId);

    List<SessionParticipant> findAllBySessionIdAndUserIdOrderByIdAsc(Long sessionId, Long userId);
    List<SessionParticipant> findAllBySessionIdAndGuestPhoneOrderByIdAsc(Long sessionId, String guestPhone);

    /**
     * Lượt đăng ký của user trong ca. Dữ liệu cũ có thể có dòng trùng → không ném lỗi,
     * ưu tiên dòng chưa bị đánh vắng (ABSENT), không có thì lấy dòng đầu tiên.
     */
    default Optional<SessionParticipant> findBySessionIdAndUserId(Long sessionId, Long userId) {
        return preferActive(findAllBySessionIdAndUserIdOrderByIdAsc(sessionId, userId));
    }

    default Optional<SessionParticipant> findBySessionIdAndGuestPhone(Long sessionId, String guestPhone) {
        return preferActive(findAllBySessionIdAndGuestPhoneOrderByIdAsc(sessionId, guestPhone));
    }

    static Optional<SessionParticipant> preferActive(List<SessionParticipant> rows) {
        if (rows == null || rows.isEmpty()) return Optional.empty();
        return rows.stream()
                .filter(p -> p.getCheckinStatus() != CheckinStatus.ABSENT)
                .findFirst()
                .or(() -> Optional.of(rows.get(0)));
    }

    /** Mọi lượt trong ca thuộc cùng user HOẶC cùng SĐT (guestPhone / SĐT của user) — chống đăng ký trùng. */
    @Query("SELECT sp FROM SessionParticipant sp LEFT JOIN sp.user u WHERE sp.session.id = :sessionId " +
           "AND (u.id = :userId OR sp.guestPhone = :phone OR u.phone = :phone) ORDER BY sp.id ASC")
    List<SessionParticipant> findBySessionAndUserOrPhone(@Param("sessionId") Long sessionId,
                                                         @Param("userId") Long userId,
                                                         @Param("phone") String phone);

    /** Đếm gộp cho danh sách ca: [sessionId, số slot đã đặt (không tính ABSENT), số đã điểm danh]. */
    @Query("SELECT sp.session.id, " +
           "SUM(CASE WHEN sp.checkinStatus <> com.smashflow.model.CheckinStatus.ABSENT THEN 1 ELSE 0 END), " +
           "SUM(CASE WHEN sp.checkinStatus = com.smashflow.model.CheckinStatus.CHECKED_IN THEN 1 ELSE 0 END) " +
           "FROM SessionParticipant sp WHERE sp.session.id IN :sessionIds GROUP BY sp.session.id")
    List<Object[]> countSlotsBySessionIds(@Param("sessionIds") Collection<Long> sessionIds);

    /** Báo cáo tháng: nạp một lần mọi lượt của các ca trong tháng (kèm user). */
    @Query("SELECT sp FROM SessionParticipant sp LEFT JOIN FETCH sp.user u WHERE sp.session.id IN :sessionIds ORDER BY sp.id ASC")
    List<SessionParticipant> findBySessionIdInWithUser(@Param("sessionIds") Collection<Long> sessionIds);

    long countBySessionId(Long sessionId);
    long countBySessionIdAndCheckinStatus(Long sessionId, CheckinStatus status);

    @Query("SELECT COUNT(sp) FROM SessionParticipant sp WHERE sp.session.id = :sessionId AND sp.checkinStatus != com.smashflow.model.CheckinStatus.ABSENT")
    long countActiveBookedSlots(Long sessionId);

    @Query("SELECT sp FROM SessionParticipant sp JOIN FETCH sp.session s LEFT JOIN FETCH sp.user u WHERE sp.session.id = :sessionId ORDER BY sp.id ASC")
    List<SessionParticipant> findBySessionIdWithDetails(Long sessionId);

    List<SessionParticipant> findByUserIdAndCheckinStatusOrderByCheckinAtDesc(Long userId, CheckinStatus status);

    List<SessionParticipant> findByUserId(Long userId);

    boolean existsByGuestPhone(String guestPhone);

    @Query("SELECT COUNT(sp) FROM SessionParticipant sp WHERE (sp.guestPhone = :phone OR (sp.user IS NOT NULL AND sp.user.phone = :phone)) AND sp.checkinStatus != com.smashflow.model.CheckinStatus.ABSENT")
    long countPastBookingsByPhone(String phone);

    @Query("SELECT DISTINCT sp.session.id FROM SessionParticipant sp WHERE (sp.user.id = :userId OR (sp.guestPhone = :phone OR (sp.user IS NOT NULL AND sp.user.phone = :phone))) AND sp.checkinStatus != com.smashflow.model.CheckinStatus.ABSENT")
    List<Long> findBookedSessionIdsByUserIdOrPhone(Long userId, String phone);

    @Query("SELECT DISTINCT sp.session.id FROM SessionParticipant sp WHERE sp.user.id = :userId AND sp.checkinStatus != com.smashflow.model.CheckinStatus.ABSENT")
    List<Long> findBookedSessionIdsByUserId(Long userId);

    /**
     * Đối soát cọc (Q5): lượt đã thu tiền, có cọc, thu trước khi có cột paid_at (tức trước bản sửa lỗi trừ cọc).
     * Bỏ qua lượt giữ cọc do vắng (FORFEITED) vì doanh thu lượt đó chính là tiền cọc.
     */
    @Query("SELECT sp FROM SessionParticipant sp JOIN FETCH sp.session s LEFT JOIN FETCH sp.user u " +
           "WHERE sp.paymentStatus = com.smashflow.model.PaymentStatus.PAID " +
           "AND sp.depositAmount > 0 AND sp.paidAt IS NULL " +
           "AND sp.depositStatus <> com.smashflow.model.DepositStatus.FORFEITED " +
           "ORDER BY s.startTime DESC, sp.id DESC")
    List<SessionParticipant> findLegacyPaidWithDeposit();
}

