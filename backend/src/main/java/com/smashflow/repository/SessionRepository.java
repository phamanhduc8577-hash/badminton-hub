package com.smashflow.repository;

import com.smashflow.model.Session;
import com.smashflow.model.SessionStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SessionRepository extends JpaRepository<Session, Long> {
    List<Session> findByStatusOrderByStartTimeDesc(SessionStatus status);
    List<Session> findAllByOrderByStartTimeDesc();

    /** Danh sách ca kèm sân + Host trong 1 truy vấn (tránh N+1 khi dựng response). */
    @Query("SELECT s FROM Session s JOIN FETCH s.venue JOIN FETCH s.host ORDER BY s.startTime DESC")
    List<Session> findAllWithDetailsOrderByStartTimeDesc();

    /** "Ca sắp tới": chưa hủy và chưa kết thúc (endTime > now), ca sớm nhất lên đầu. */
    @Query("SELECT s FROM Session s JOIN FETCH s.venue JOIN FETCH s.host " +
           "WHERE s.status <> com.smashflow.model.SessionStatus.CANCELLED AND s.endTime > :now " +
           "ORDER BY s.startTime ASC")
    List<Session> findUpcomingWithDetails(@Param("now") LocalDateTime now);

    /** Số ca KHÁC đang dùng cùng sân (để biết có được sửa trực tiếp venue không). */
    long countByVenueIdAndIdNot(Long venueId, Long id);

    @Query("SELECT s FROM Session s WHERE s.startTime >= :start AND s.startTime <= :end ORDER BY s.startTime DESC")
    List<Session> findByStartTimeBetweenOrderByStartTimeDesc(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Session s WHERE s.id = :id")
    Optional<Session> findByIdWithLock(@Param("id") Long id);
}
