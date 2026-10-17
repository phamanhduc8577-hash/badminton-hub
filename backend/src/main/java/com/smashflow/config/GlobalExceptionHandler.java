package com.smashflow.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.TypeMismatchException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

/**
 * - Lỗi nghiệp vụ: {@code new RuntimeException("thông báo tiếng Việt")} → 400 kèm thông báo (giữ như cũ).
 * - Sai quyền → 403 (chưa đăng nhập → 401).
 * - Lỗi không lường trước (NPE, lỗi DB, lỗi framework...) → 500 với thông báo chung; chi tiết chỉ ghi log.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    public static final String FORBIDDEN_MESSAGE = "Bạn không có quyền thực hiện thao tác này!";
    public static final String UNAUTHORIZED_MESSAGE = "Vui lòng đăng nhập để tiếp tục!";
    public static final String INTERNAL_ERROR_MESSAGE = "Đã xảy ra lỗi hệ thống, vui lòng thử lại!";
    public static final String BAD_REQUEST_MESSAGE = "Dữ liệu gửi lên không hợp lệ!";
    public static final String NOT_FOUND_MESSAGE = "Không tìm thấy tài nguyên yêu cầu!";

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.put("message", error.getDefaultMessage());
            break;
        }
        if (errors.isEmpty()) {
            errors.put("message", BAD_REQUEST_MESSAGE);
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errors);
    }

    @ExceptionHandler({AccessDeniedException.class, AuthorizationDeniedException.class})
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        if (isAnonymous()) {
            return body(HttpStatus.UNAUTHORIZED, UNAUTHORIZED_MESSAGE);
        }
        return body(HttpStatus.FORBIDDEN, FORBIDDEN_MESSAGE);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, String>> handleAuthentication(AuthenticationException ex) {
        return body(HttpStatus.UNAUTHORIZED, UNAUTHORIZED_MESSAGE);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, TypeMismatchException.class})
    public ResponseEntity<Map<String, String>> handleBadInput(Exception ex) {
        log.debug("Yêu cầu không hợp lệ: {}", ex.toString());
        return body(HttpStatus.BAD_REQUEST, BAD_REQUEST_MESSAGE);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException ex) {
        if (ex instanceof ErrorResponse errorResponse) {
            return fromErrorResponse(errorResponse, ex);
        }
        // Lỗi nghiệp vụ trong dự án luôn được ném bằng đúng lớp RuntimeException kèm thông báo
        if (ex.getClass() == RuntimeException.class && ex.getMessage() != null && !ex.getMessage().isBlank()) {
            return body(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
        return internalError(ex);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGenericException(Exception ex) {
        if (ex instanceof ErrorResponse errorResponse) {
            return fromErrorResponse(errorResponse, ex);
        }
        return internalError(ex);
    }

    private ResponseEntity<Map<String, String>> fromErrorResponse(ErrorResponse errorResponse, Exception ex) {
        HttpStatusCode status = errorResponse.getStatusCode();
        if (status.is5xxServerError()) {
            return internalError(ex);
        }
        String message = status.value() == HttpStatus.NOT_FOUND.value() ? NOT_FOUND_MESSAGE : BAD_REQUEST_MESSAGE;
        Map<String, String> error = new HashMap<>();
        error.put("message", message);
        return ResponseEntity.status(status).body(error);
    }

    private ResponseEntity<Map<String, String>> internalError(Exception ex) {
        log.error("Lỗi hệ thống không lường trước", ex);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, INTERNAL_ERROR_MESSAGE);
    }

    private static ResponseEntity<Map<String, String>> body(HttpStatus status, String message) {
        Map<String, String> error = new HashMap<>();
        error.put("message", message);
        return ResponseEntity.status(status).body(error);
    }

    private static boolean isAnonymous() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null || auth instanceof AnonymousAuthenticationToken || !auth.isAuthenticated();
    }
}
