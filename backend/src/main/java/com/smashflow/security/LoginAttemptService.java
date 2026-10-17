package com.smashflow.security;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Giới hạn đăng nhập sai theo SĐT (bổ sung cho giới hạn theo IP ở RateLimitingFilter):
 * sai {@value #MAX_FAILURES} lần trong 15 phút → khóa đăng nhập SĐT đó 15 phút.
 * Lưu trong bộ nhớ (Render chạy 1 instance).
 */
@Component
public class LoginAttemptService {

    public static final int MAX_FAILURES = 10;
    public static final Duration WINDOW = Duration.ofMinutes(15);
    public static final Duration LOCK_DURATION = Duration.ofMinutes(15);
    private static final int CLEANUP_THRESHOLD = 10_000;

    private static final class Attempts {
        final Deque<Instant> failures = new ArrayDeque<>();
        Instant lockedUntil;
    }

    private final ConcurrentHashMap<String, Attempts> attempts = new ConcurrentHashMap<>();
    private final Clock clock;

    public LoginAttemptService() {
        this(Clock.systemUTC());
    }

    public LoginAttemptService(Clock clock) {
        this.clock = clock;
    }

    public boolean isLocked(String phone) {
        String key = normalize(phone);
        Attempts a = attempts.get(key);
        if (a == null) {
            return false;
        }
        synchronized (a) {
            Instant now = clock.instant();
            if (a.lockedUntil != null && now.isBefore(a.lockedUntil)) {
                return true;
            }
            if (a.lockedUntil != null) {
                // Hết thời gian khóa → cho thử lại từ đầu
                a.lockedUntil = null;
                a.failures.clear();
            }
            return false;
        }
    }

    public void recordFailure(String phone) {
        String key = normalize(phone);
        Instant now = clock.instant();
        Attempts a = attempts.computeIfAbsent(key, k -> new Attempts());
        synchronized (a) {
            while (!a.failures.isEmpty() && a.failures.peekFirst().isBefore(now.minus(WINDOW))) {
                a.failures.pollFirst();
            }
            a.failures.addLast(now);
            if (a.failures.size() >= MAX_FAILURES) {
                a.lockedUntil = now.plus(LOCK_DURATION);
            }
        }
        cleanupIfNeeded(now);
    }

    public void recordSuccess(String phone) {
        attempts.remove(normalize(phone));
    }

    private void cleanupIfNeeded(Instant now) {
        if (attempts.size() <= CLEANUP_THRESHOLD) {
            return;
        }
        attempts.entrySet().removeIf(e -> {
            Attempts a = e.getValue();
            synchronized (a) {
                boolean lockExpired = a.lockedUntil == null || !now.isBefore(a.lockedUntil);
                boolean noRecentFailure = a.failures.isEmpty() || a.failures.peekLast().isBefore(now.minus(WINDOW));
                return lockExpired && noRecentFailure;
            }
        });
    }

    private static String normalize(String phone) {
        return phone == null ? "" : phone.trim();
    }
}
