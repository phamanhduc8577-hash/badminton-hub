package com.smashflow.repository;

import com.smashflow.model.Match;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MatchRepository extends JpaRepository<Match, Long> {
    List<Match> findBySessionIdOrderByCreatedAtDesc(Long sessionId);

    @Query("SELECT m FROM Match m WHERE m.teamAPlayer1.id = :userId OR m.teamAPlayer2.id = :userId OR m.teamBPlayer1.id = :userId OR m.teamBPlayer2.id = :userId ORDER BY m.createdAt DESC")
    List<Match> findAllByUserId(Long userId);
}
