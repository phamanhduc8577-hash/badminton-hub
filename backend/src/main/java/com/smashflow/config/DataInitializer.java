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

            // Check if host exists
            if (!userRepository.existsByPhone("0325872682")) {
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
                        .build();
                userRepository.save(host);
            } else {
                userRepository.findByPhone("0325872682").ifPresent(host -> {
                    host.setRole(Role.HOST);
                    host.setMembershipType(MembershipType.FIXED);
                    host.setPassword(passwordEncoder.encode("040304"));
                    host.setFullName("Phạm Anh Đức");
                    host.setAvatarUrl("/duck-host-sassy.png");
                    userRepository.save(host);
                });
            }

            // CLEAN UP ALL DUMMY / TEST ACCOUNTS & SESSIONS & VENUES TO START PRODUCTION CLEAN
            try {
                // Delete all matches, participants, loyalty rewards, sessions, venues
                jdbcTemplate.execute("DELETE FROM matches;");
                jdbcTemplate.execute("DELETE FROM session_participants;");
                jdbcTemplate.execute("DELETE FROM loyalty_rewards;");
                jdbcTemplate.execute("DELETE FROM sessions;");
                jdbcTemplate.execute("DELETE FROM venues;");
                // Delete all users except Host Phạm Anh Đức (0325872682)
                jdbcTemplate.execute("DELETE FROM users WHERE phone != '0325872682';");
            } catch (Exception e) {
                System.err.println("Clean database error: " + e.getMessage());
            }
        };
    }
}

