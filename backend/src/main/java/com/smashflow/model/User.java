package com.smashflow.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 20)
    private String phone;

    @Column(nullable = false, length = 100)
    private String fullName;

    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private Gender gender = Gender.MALE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Role role = Role.MEMBER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MembershipType membershipType = MembershipType.CASUAL;

    @Column(columnDefinition = "TEXT")
    private String avatarUrl;

    @Builder.Default
    private Integer winCount = 0;

    @Builder.Default
    private Integer lossCount = 0;

    @Builder.Default
    private Integer eloScore = 0;

    @Builder.Default
    private Integer sessionsAttended = 0;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public double getWinRate() {
        int total = winCount + lossCount;
        if (total == 0) return 0.0;
        return Math.round(((double) winCount / total) * 100.0 * 10.0) / 10.0;
    }

    public int getEloScore() {
        return eloScore != null ? Math.max(0, eloScore) : 0;
    }
}
