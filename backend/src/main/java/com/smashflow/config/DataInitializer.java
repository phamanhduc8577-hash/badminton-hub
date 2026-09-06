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
                        .winCount(12)
                        .lossCount(3)
                        .eloScore(9)
                        .sessionsAttended(25)
                        .build();
                userRepository.save(host);
            }

            if (!userRepository.existsByPhone("0901234567")) {
                User hostBackup = User.builder()
                        .phone("0901234567")
                        .fullName("Phạm Anh Đức (Admin)")
                        .password(passwordEncoder.encode("123456"))
                        .gender(Gender.MALE)
                        .role(Role.HOST)
                        .membershipType(MembershipType.FIXED)
                        .avatarUrl("/duck-mascot.png")
                        .winCount(12)
                        .lossCount(3)
                        .eloScore(9)
                        .sessionsAttended(25)
                        .build();
                userRepository.save(hostBackup);

                // Create comprehensive test roster for full matchmaking & testing
                String[][] members = {
                        {"0912345678", "Nguyễn Văn An", "MALE", "8", "4", "4", "15"},
                        {"0987654321", "Trần Thị Bình", "FEMALE", "5", "5", "0", "10"},
                        {"0908111222", "Lê Hoàng Long", "MALE", "14", "2", "12", "20"},
                        {"0908333444", "Phạm Minh Tuấn", "MALE", "9", "6", "3", "12"},
                        {"0908555666", "Đỗ Quỳnh Như", "FEMALE", "7", "5", "2", "9"},
                        {"0908777888", "Vũ Quốc Bảo", "MALE", "18", "4", "14", "22"},
                        {"0908999000", "Ngô Bảo Châu", "FEMALE", "11", "3", "8", "16"},
                        {"0908123789", "Đặng Tuấn Kiệt", "MALE", "6", "8", "0", "8"}
                };

                for (String[] m : members) {
                    if (!userRepository.existsByPhone(m[0])) {
                        User u = User.builder()
                                .phone(m[0])
                                .fullName(m[1])
                                .password(passwordEncoder.encode("123456"))
                                .gender(Gender.valueOf(m[2]))
                                .membershipType(MembershipType.FIXED)
                                .avatarUrl("/duck-mascot.png")
                                .winCount(Integer.parseInt(m[3]))
                                .lossCount(Integer.parseInt(m[4]))
                                .eloScore(Integer.parseInt(m[5]))
                                .sessionsAttended(Integer.parseInt(m[6]))
                                .build();
                        userRepository.save(u);
                    }
                }
            }

            // Update or seed test account: Nhân Thiện (0763595633) with 50 wins and 5 sessions
            userRepository.findByPhone("0763595633").ifPresentOrElse(
                    user -> {
                        user.setWinCount(50);
                        user.setLossCount(0);
                        user.setEloScore(50);
                        user.setSessionsAttended(5);
                        userRepository.save(user);
                    },
                    () -> {
                        User user = User.builder()
                                .phone("0763595633")
                                .fullName("Nhân Thiện")
                                .password(passwordEncoder.encode("123456"))
                                .gender(Gender.MALE)
                                .role(Role.MEMBER)
                                .membershipType(MembershipType.FIXED)
                                .avatarUrl("/duck-mascot.png")
                                .winCount(50)
                                .lossCount(0)
                                .eloScore(50)
                                .sessionsAttended(5)
                                .build();
                        userRepository.save(user);
                    }
            );

            // Create a default venue if none exists
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

