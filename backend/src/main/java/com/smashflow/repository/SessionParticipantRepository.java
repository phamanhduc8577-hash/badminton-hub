package com.smashflow.repository;

import com.smashflow.model.CheckinStatus;
import com.smashflow.model.SessionParticipant;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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
    Optional<SessionParticipant> findBySessionIdAndUserId(Long sessionId, Long userId);
    Optional<SessionParticipant> findBySessionIdAndGuestPhone(Long sessionId, String guestPhone);
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

