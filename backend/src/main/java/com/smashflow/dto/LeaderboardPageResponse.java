package com.smashflow.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Một trang của bảng xếp hạng.
 * - entries: các dòng của trang hiện tại (đã có số hạng toàn cục).
 * - me: hạng của người đang đăng nhập (null nếu chưa đăng nhập hoặc không có trong bảng),
 *       luôn kèm theo để giao diện ghim hạng của họ ngay cả khi họ nằm ngoài trang đang xem.
 */
@Data
@Builder
public class LeaderboardPageResponse {
    private List<LeaderboardEntry> entries;
    private LeaderboardEntry me;
    private int page;
    private int size;
    private int total;
    private boolean hasMore;
}
