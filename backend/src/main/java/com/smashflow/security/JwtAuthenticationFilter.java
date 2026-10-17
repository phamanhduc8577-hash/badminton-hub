package com.smashflow.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final TokenAuthenticator tokenAuthenticator;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        // Token sai / hết hạn / user đã xóa / token_version cũ → không xác thực (request đi tiếp dưới dạng ẩn danh)
        tokenAuthenticator.resolveFromHeader(request.getHeader("Authorization")).ifPresent(user -> {
            SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + user.getRole().name());
            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(user, null, Collections.singletonList(authority));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        });

        filterChain.doFilter(request, response);
    }
}
