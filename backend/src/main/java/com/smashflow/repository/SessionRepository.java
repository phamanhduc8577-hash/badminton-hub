package com.smashflow.repository;

import com.smashflow.model.Session;
import com.smashflow.model.SessionStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SessionRepository extends JpaRepository<Session, Long> {
    List<Session> findByStatusOrderByStartTimeDesc(SessionStatus status);
    List<Session> findAllByOrderByStartTimeDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Session s WHERE s.id = :id")
    Optional<Session> findByIdWithLock(@Param("id") Long id);
}
