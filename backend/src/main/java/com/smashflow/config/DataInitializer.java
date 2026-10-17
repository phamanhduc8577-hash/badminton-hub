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
@lombok.extern.slf4j.Slf4j
public class DataInitializer {

    @org.springframework.beans.factory.annotation.Value("${host.initial-password:}")
    private String hostInitialPassword;

    @org.springframework.beans.factory.annotation.Value("${host.phone:0325872682}")
    private String hostPhone;

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
                jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;");
                jdbcTemplate.execute("UPDATE users SET deleted = FALSE WHERE deleted IS NULL;");
                jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_type VARCHAR(20) DEFAULT 'CASUAL';");
                jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS placement_matches INT DEFAULT 0;");
                jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0;");
                jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS shield_matches INT DEFAULT 0;");
                jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_password_reset_count INT DEFAULT 0;");
                jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_reset_date DATE;");
                // token_version: tăng khi đổi mật khẩu / xóa / Host reset → JWT cũ hết hiệu lực
                jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 0;");
                jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN token_version SET DEFAULT 0;");
                jdbcTemplate.execute("UPDATE users SET token_version = 0 WHERE token_version IS NULL;");
                jdbcTemplate.execute("UPDATE users SET membership_type = 'FIXED' WHERE role = 'HOST';");
                // Đồng bộ chính xác số buổi tham gia theo đúng số ca người đó đã điểm danh (CHECKED_IN)
                jdbcTemplate.execute("""
                    UPDATE users u SET sessions_attended = (
                        SELECT COUNT(DISTINCT sp.session_id)
                        FROM session_participants sp
                        WHERE sp.user_id = u.id AND sp.checkin_status = 'CHECKED_IN'
                    ) WHERE u.id IS NOT NULL;
                """);
            } catch (Exception ignored) {
            }

            // Ensure host account exists and has proper role & membership (SĐT Host cấu hình qua HOST_PHONE)
            userRepository.findByPhone(hostPhone).ifPresentOrElse(
                    host -> {
                        host.setRole(Role.HOST);
                        host.setMembershipType(MembershipType.FIXED);
                        // Không ghi đè mật khẩu Host: mật khẩu do Host tự đổi phải được giữ nguyên sau mỗi lần khởi động
                        if (host.getFullName() == null || host.getFullName().isBlank()) {
                            host.setFullName("Phạm Anh Đức");
                        }
                        if (host.getAvatarUrl() == null || host.getAvatarUrl().isBlank()) {
                            host.setAvatarUrl("/duck-host-sassy.png");
                        }
                        userRepository.save(host);
                    },
                    () -> {
                        // Chỉ chạy khi DB chưa có Host (database mới). Mật khẩu lấy từ biến môi trường HOST_INITIAL_PASSWORD.
                        String initialPassword = (hostInitialPassword != null && !hostInitialPassword.isBlank())
                                ? hostInitialPassword
                                : java.util.UUID.randomUUID().toString().substring(0, 12);
                        if (hostInitialPassword == null || hostInitialPassword.isBlank()) {
                            // Không ghi mật khẩu ra log. Host đặt HOST_INITIAL_PASSWORD rồi khởi động lại DB mới,
                            // hoặc dùng "Quên mật khẩu" (mật khẩu tạm gửi qua Telegram).
                            log.warn("HOST_INITIAL_PASSWORD chưa được đặt. Đã tạo Host với mật khẩu ngẫu nhiên (không ghi log) - hãy dùng chức năng Quên mật khẩu hoặc đặt HOST_INITIAL_PASSWORD.");
                        }
                        User host = User.builder()
                                .phone(hostPhone)
                                .fullName("Phạm Anh Đức")
                                .password(passwordEncoder.encode(initialPassword))
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


