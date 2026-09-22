package com.smashflow.service;

import com.smashflow.model.*;
import com.smashflow.repository.MatchRepository;
import com.smashflow.repository.SessionRepository;
import com.smashflow.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
public class MatchServiceShieldTest {

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SessionRepository sessionRepository;

    @InjectMocks
    private MatchService matchService;

    private User player;

    @BeforeEach
    void setUp() {
        player = User.builder()
                .id(1L)
                .fullName("Test Player")
                .phone("0912345678")
                .eloScore(290) // Sắt I (290 LP)
                .placementMatches(5) // Placements completed
                .currentStreak(0)
                .shieldMatches(0)
                .winCount(10)
                .lossCount(5)
                .build();
    }

    @Test
    @DisplayName("Thăng hạng từ Sắt I (290 LP) lên Đồng III (310 LP) được cấp 3 khiên giáp")
    void testPromotionMajorTierGrantsThreeShields() {
        // Win match to cross from 290 LP to >= 300 LP (Đồng III)
        ReflectionTestUtils.invokeMethod(matchService, "applyMatchOutcome", player, true, 300, 300);

        assertTrue(player.getEloScore() >= 300, "Phải lên mốc Đồng III (>=300 LP)");
        assertEquals(3, player.getShieldMatches(), "Thăng bậc lớn phải được cấp 3 khiên giáp");
    }

    @Test
    @DisplayName("Khi ở mốc 300 LP (Đồng III) có 3 khiên: Thua 1 trận mất 1 khiên, giữ nguyên 300 LP")
    void testShieldProtectsOnLossAtZeroLp() {
        player.setEloScore(300); // 0 LP ở Đồng III
        player.setShieldMatches(3);

        // Thua trận 1
        ReflectionTestUtils.invokeMethod(matchService, "applyMatchOutcome", player, false, 300, 300);

        assertEquals(300, player.getEloScore(), "Khiên bảo vệ giữ nguyên 300 LP (0 LP Đồng III)");
        assertEquals(2, player.getShieldMatches(), "Phải tiêu hao 1 khiên, còn lại 2 khiên");
    }

    @Test
    @DisplayName("Sau khi thua mất 1 khiên (còn 2), thắng 1 trận thì vẫn giữ nguyên 2 khiên")
    void testWinPreservesRemainingShields() {
        player.setEloScore(300);
        player.setShieldMatches(2);

        // Thắng trận tiếp theo
        ReflectionTestUtils.invokeMethod(matchService, "applyMatchOutcome", player, true, 300, 300);

        assertTrue(player.getEloScore() > 300, "Điểm LP phải tăng lên");
        assertEquals(2, player.getShieldMatches(), "Số khiên còn lại phải giữ nguyên 2");
    }

    @Test
    @DisplayName("Thua liên tiếp khi hết khiên (shield=0) tại 300 LP thì rớt về 275 LP (Sắt I 75 điểm)")
    void testDemotionWhenShieldExhausted() {
        player.setEloScore(300);
        player.setShieldMatches(1);

        // Thua lần 1: mất khiên cuối cùng (về 0 khiên), điểm vẫn giữ 300
        ReflectionTestUtils.invokeMethod(matchService, "applyMatchOutcome", player, false, 300, 300);
        assertEquals(300, player.getEloScore());
        assertEquals(0, player.getShieldMatches());

        // Thua lần 2 (khi khiên = 0): Bị rớt rank về 275 LP (Sắt I)
        ReflectionTestUtils.invokeMethod(matchService, "applyMatchOutcome", player, false, 300, 300);
        assertEquals(275, player.getEloScore(), "Phải rớt về 275 LP (75 LP của Sắt I)");
        assertEquals(0, player.getShieldMatches());
    }

    @Test
    @DisplayName("Thăng đoàn nhỏ (Đồng III 390 LP -> Đồng II 410 LP) được cấp 1 khiên nếu chưa có khiên cao hơn")
    void testPromotionDivisionGrantsOneShield() {
        player.setEloScore(390); // Đồng III 90 LP
        player.setShieldMatches(0);

        // Win to cross 400 LP (Đồng II)
        ReflectionTestUtils.invokeMethod(matchService, "applyMatchOutcome", player, true, 400, 400);

        assertTrue(player.getEloScore() >= 400, "Phải lên mốc Đồng II (>= 400 LP)");
        assertEquals(1, player.getShieldMatches(), "Thăng đoàn nhỏ được cấp 1 khiên");
    }
}
