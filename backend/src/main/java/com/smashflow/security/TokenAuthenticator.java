package com.smashflow.security;

import com.smashflow.model.User;
import com.smashflow.repository.UserRepository;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Optional;

/**
 * Điểm kiểm tra JWT dùng chung (filter + các đường fallback trong AuthController):
 * token hợp lệ, user tồn tại, chưa bị xóa và claim "tv" khớp users.token_version.
 */
@Component
@RequiredArgsConstructor
public class TokenAuthenticator {

    private final JwtProvider jwtProvider;
    private final UserRepository userRepository;

    /** Nhận giá trị header Authorization ("Bearer ..."). */
    public Optional<User> resolveFromHeader(String authorizationHeader) {
        if (StringUtils.hasText(authorizationHeader) && authorizationHeader.startsWith("Bearer ")) {
            return resolve(authorizationHeader.substring(7));
        }
        return Optional.empty();
    }

    /** Nhận token thô. Trả về empty nếu token không hợp lệ hoặc đã bị thu hồi. */
    public Optional<User> resolve(String token) {
        if (!StringUtils.hasText(token)) {
            return Optional.empty();
        }
        Optional<Claims> claims = jwtProvider.parseClaims(token);
        if (claims.isEmpty() || claims.get().getSubject() == null) {
            return Optional.empty();
        }
        int tokenVersion = JwtProvider.getTokenVersion(claims.get());
        return userRepository.findByPhone(claims.get().getSubject())
                .filter(user -> !Boolean.TRUE.equals(user.getDeleted()))
                .filter(user -> user.currentTokenVersion() == tokenVersion);
    }
}
