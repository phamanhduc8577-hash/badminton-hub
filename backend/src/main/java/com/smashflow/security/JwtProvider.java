package com.smashflow.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtProvider {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(JwtProvider.class);
    private static final String INSECURE_DEFAULT_SECRET = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";

    private final SecretKey key;
    private final long expiration;

    public JwtProvider(@Value("${jwt.secret}") String secret,
                       @Value("${jwt.expiration}") long expiration) {
        if (INSECURE_DEFAULT_SECRET.equals(secret)) {
            log.error("!!! BẢO MẬT: JWT_SECRET chưa được đặt, đang dùng secret mặc định công khai trong mã nguồn. Hãy đặt biến môi trường JWT_SECRET trên Render ngay !!!");
        } else {
            log.info("JWT_SECRET đã được cấu hình từ biến môi trường.");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiration = expiration;
    }

    /** Tên claim chứa token_version của user. Token cũ không có claim này được coi là version 0. */
    public static final String TOKEN_VERSION_CLAIM = "tv";

    public String generateToken(com.smashflow.model.User user) {
        return generateToken(user.getPhone(), user.getRole().name(), user.getId(), user.currentTokenVersion());
    }

    public String generateToken(String phone, String role, Long userId, int tokenVersion) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiration);

        return Jwts.builder()
                .subject(phone)
                .claim("role", role)
                .claim("userId", userId)
                .claim(TOKEN_VERSION_CLAIM, tokenVersion)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(key)
                .compact();
    }

    /** Parse + verify chữ ký/hạn dùng. Trả về empty nếu token không hợp lệ. */
    public java.util.Optional<Claims> parseClaims(String token) {
        try {
            return java.util.Optional.of(Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload());
        } catch (Exception e) {
            return java.util.Optional.empty();
        }
    }

    /** Lấy claim "tv"; thiếu claim (token phát hành trước khi có token_version) → 0. */
    public static int getTokenVersion(Claims claims) {
        Object tv = claims.get(TOKEN_VERSION_CLAIM);
        if (tv instanceof Number n) {
            return n.intValue();
        }
        if (tv instanceof String s) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException ignored) {
                return -1; // giá trị lạ → không khớp với bất kỳ version hợp lệ nào
            }
        }
        return 0;
    }

    public String getPhoneFromToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return claims.getSubject();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
