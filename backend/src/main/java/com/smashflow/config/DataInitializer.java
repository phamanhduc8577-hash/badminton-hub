package com.smashflow.config;

import com.smashflow.model.Gender;
import com.smashflow.model.MembershipType;
import com.smashflow.model.Role;
import com.smashflow.model.User;
import com.smashflow.model.Venue;
import com.smashflow.repository.UserRepository;
import com.smashflow.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;

@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final UserRepository userRepository;
    private final VenueRepository venueRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    @Bean
    public CommandLineRunner initData() {
        return args -> {
            // Ensure avatar_url column in database is TEXT (unlimited length) for base64 uploads
            try {
                jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT;");
            } catch (Exception ignored) {
            }

            // Ensure membership_type and lol elo columns exist in database
            try {
                jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_type VARCHAR(20) DEFAULT 'CASUAL';");
                jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS placement_matches INT DEFAULT 0;");
                jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0;");
                jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS shield_matches INT DEFAULT 0;");
                jdbcTemplate.execute("UPDATE users SET membership_type = 'FIXED' WHERE role = 'HOST';");
            } catch (Exception ignored) {
            }

            // Ensure host account exists and has proper role & membership
            userRepository.findByPhone("0325872682").ifPresentOrElse(
                    host -> {
                        host.setRole(Role.HOST);
                        host.setMembershipType(MembershipType.FIXED);
                        if (host.getFullName() == null || host.getFullName().isBlank()) {
                            host.setFullName("Phạm Anh Đức");
                        }
                        if (host.getAvatarUrl() == null || host.getAvatarUrl().isBlank()) {
                            host.setAvatarUrl("/duck-host-sassy.png");
                        }
                        userRepository.save(host);
                    },
                    () -> {
                        User host = User.builder()
                                .phone("0325872682")
                                .fullName("Phạm Anh Đức")
                                .password(passwordEncoder.encode("040304"))
                                .gender(Gender.MALE)
                                .role(Role.HOST)
                                .membershipType(MembershipType.FIXED)
                                .avatarUrl("/duck-host-sassy.png")
                                .winCount(0)
                                .lossCount(0)
                                .eloScore(0)
                                .sessionsAttended(0)
                                .placementMatches(0)
                                .currentStreak(0)
                                .shieldMatches(0)
                                .build();
                        userRepository.save(host);
                    }
            );

            // Create default venue if none exists
            if (venueRepository.count() == 0) {
                Venue venue = Venue.builder()
                        .name("Sân Cầu Lông SmashHub Quận 7")
                        .address("123 Nguyễn Thị Thập, Tân Phú, Quận 7, TP.HCM")
                        .latitude(new BigDecimal("10.7380120"))
                        .longitude(new BigDecimal("106.7153450"))
                        .radiusMeters(150)
                        .build();
                venueRepository.save(venue);
            }
        };
    }
}


