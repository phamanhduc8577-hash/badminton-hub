package com.smashflow.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * In-memory Token-bucket Rate Limiter for Public Authentication Endpoints.
 * Limits brute-force login and spamming attacks without requiring external dependencies.
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS_PER_MINUTE = 20; // 20 attempts per minute per IP for Auth APIs
    private static final long TIME_WINDOW_MS = 60 * 1000L;

    private static class RequestCounter {
        long timestamp;
        AtomicInteger count;

        RequestCounter(long timestamp) {
            this.timestamp = timestamp;
            this.count = new AtomicInteger(1);
        }
    }

    private final ConcurrentHashMap<String, RequestCounter> requestCounts = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();

        // Rate limit critical authentication & public booking endpoints
        if (path.startsWith("/api/auth/login") || path.startsWith("/api/auth/register") || path.contains("/book")) {
            String clientIp = getClientIp(request);
            String key = clientIp + ":" + path;
            long now = System.currentTimeMillis();

            RequestCounter counter = requestCounts.compute(key, (k, existing) -> {
                if (existing == null || (now - existing.timestamp) > TIME_WINDOW_MS) {
                    return new RequestCounter(now);
                } else {
                    existing.count.incrementAndGet();
                    return existing;
                }
            });

            if (counter.count.get() > MAX_REQUESTS_PER_MINUTE) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"status\":429,\"message\":\"Bạn đã gửi quá nhiều yêu cầu trong thời gian ngắn! Vui lòng thử lại sau 1 phút.\"}");
                return;
            }
        }

        // Periodic light cleanup
        if (requestCounts.size() > 5000) {
            long now = System.currentTimeMillis();
            requestCounts.entrySet().removeIf(entry -> (now - entry.getValue().timestamp) > TIME_WINDOW_MS * 2);
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }
}
