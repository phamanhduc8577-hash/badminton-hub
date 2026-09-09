package com.smashflow.repository;

import com.smashflow.model.CheckinStatus;
import com.smashflow.model.SessionParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SessionParticipantRepository extends JpaRepository<SessionParticipant, Long> {
    List<SessionParticipant> findBySessionId(Long sessionId);
    Optional<SessionParticipant> findBySessionIdAndUserId(Long sessionId, Long userId);
    Optional<SessionParticipant> findBySessionIdAndGuestPhone(Long sessionId, String guestPhone);
    long countBySessionId(Long sessionId);
    long countBySessionIdAndCheckinStatus(Long sessionId, CheckinStatus status);

    @Query("SELECT COUNT(sp) FROM SessionParticipant sp WHERE sp.session.id = :sessionId AND sp.checkinStatus != com.smashflow.model.CheckinStatus.ABSENT")
    long countActiveBookedSlots(Long sessionId);

    @Query("SELECT sp FROM SessionParticipant sp JOIN FETCH sp.session s LEFT JOIN FETCH sp.user u WHERE sp.session.id = :sessionId")
    List<SessionParticipant> findBySessionIdWithDetails(Long sessionId);

    List<SessionParticipant> findByUserIdAndCheckinStatusOrderByCheckinAtDesc(Long userId, CheckinStatus status);

    List<SessionParticipant> findByUserId(Long userId);

    boolean existsByGuestPhone(String guestPhone);

    @Query("SELECT COUNT(sp) FROM SessionParticipant sp WHERE (sp.guestPhone = :phone OR (sp.user IS NOT NULL AND sp.user.phone = :phone)) AND sp.checkinStatus != com.smashflow.model.CheckinStatus.ABSENT")
    long countPastBookingsByPhone(String phone);
}

