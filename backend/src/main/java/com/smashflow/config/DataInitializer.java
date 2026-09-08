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

            // Seed active club members if they don't exist
            // Phone, FullName, Gender, MembershipType, winCount, lossCount, eloScore, sessionsAttended, placementMatches, currentStreak, shieldMatches
            Object[][] initialMembers = {
                    {"0912345678", "Nguyễn Văn An", Gender.MALE, MembershipType.FIXED, 8, 4, 35, 15, 5, 2, 1},
                    {"0987654321", "Trần Thị Bình", Gender.FEMALE, MembershipType.FIXED, 5, 5, 20, 10, 5, 0, 0},
                    {"0908111222", "Lê Hoàng Long", Gender.MALE, MembershipType.FIXED, 14, 2, 75, 20, 5, 4, 2},
                    {"0908333444", "Phạm Minh Tuấn", Gender.MALE, MembershipType.FIXED, 9, 6, 42, 12, 5, 1, 0},
                    {"0908555666", "Đỗ Quỳnh Như", Gender.FEMALE, MembershipType.PENDING_FIXED, 3, 2, 15, 4, 3, 1, 0},
                    {"0908777888", "Vũ Quốc Bảo", Gender.MALE, MembershipType.FIXED, 18, 4, 88, 22, 5, 5, 3},
                    {"0908999000", "Ngô Bảo Châu", Gender.FEMALE, MembershipType.CASUAL, 4, 3, 18, 5, 4, 0, 0},
                    {"0908123789", "Đặng Tuấn Kiệt", Gender.MALE, MembershipType.CASUAL, 6, 8, 25, 8, 5, 0, 0},
                    {"0763595633", "Nhân Thiện", Gender.MALE, MembershipType.FIXED, 50, 0, 150, 30, 5, 10, 5}
            };

            for (Object[] m : initialMembers) {
                String phone = (String) m[0];
                if (!userRepository.existsByPhone(phone)) {
                    User u = User.builder()
                            .phone(phone)
                            .fullName((String) m[1])
                            .password(passwordEncoder.encode("123456"))
                            .gender((Gender) m[2])
                            .role(Role.MEMBER)
                            .membershipType((MembershipType) m[3])
                            .avatarUrl("/duck-mascot.png")
                            .winCount((Integer) m[4])
                            .lossCount((Integer) m[5])
                            .eloScore((Integer) m[6])
                            .sessionsAttended((Integer) m[7])
                            .placementMatches((Integer) m[8])
                            .currentStreak((Integer) m[9])
                            .shieldMatches((Integer) m[10])
                            .build();
                    userRepository.save(u);
                }
            }

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

