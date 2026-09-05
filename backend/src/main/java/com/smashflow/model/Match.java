package com.smashflow.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "matches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Match {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private Session session;

    // Team A
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_a_player1_id", nullable = false)
    private User teamAPlayer1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_a_player2_id")
    private User teamAPlayer2;

    // Team B
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_b_player1_id", nullable = false)
    private User teamBPlayer1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_b_player2_id")
    private User teamBPlayer2;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5)
    private WinningTeam winningTeam;

    @Column(length = 50)
    private String courtName; // e.g. "Sân 1", "Sân 2", "Sân 3"

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
