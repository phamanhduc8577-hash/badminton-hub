# SmashFlow Master Implementation Plan

**Tech Stack:**
- **Backend:** Java 21 + Spring Boot 3 (Spring Security, Spring Data JPA, Hibernate, JWT)
- **Frontend:** React 18 / Vite + TypeScript + TailwindCSS + Shadcn UI + Lucide Icons + TanStack Query + Zustand
- **Database:** PostgreSQL
- **Payment & QR:** VietQR dynamic format + html5-qrcode / qrcode.react
- **Security & GPS:** Haversine formula (GPS geofencing <= 150m) + HMAC Dynamic Token (15-min TTL)

---

## Architecture & Data Model (Core Entities)

1. `users`: `id`, `phone` (unique), `full_name`, `gender` (MALE/FEMALE), `role` (HOST/MEMBER/GUEST), `win_count`, `loss_count`, `sessions_attended`
2. `venues`: `id`, `name`, `address`, `latitude`, `longitude`, `radius_meters` (default 150)
3. `sessions`: `id`, `venue_id`, `host_id`, `start_time`, `end_time`, `status` (UPCOMING/ACTIVE/COMPLETED/CANCELLED), `max_slots`, `deposit_amount`, `cost_court`, `cost_shuttlecock`, `checkin_token`, `token_expires_at`
4. `session_participants`: `id`, `session_id`, `user_id`, `is_guest`, `guest_phone`, `guest_name`, `gender`, `checkin_status` (PENDING/CHECKED_IN/LATE/ABSENT), `checkin_at`, `deposit_status` (NONE/PENDING/PAID/REFUNDED), `deposit_amount`, `base_fee`, `adjustment_amount`, `adjustment_reason`, `final_fee`, `payment_status` (UNPAID/PAID), `payment_method` (VIETQR/CASH)
5. `matches`: `id`, `session_id`, `team_a_player1_id`, `team_a_player2_id`, `team_b_player1_id`, `team_b_player2_id`, `winning_team` (A/B), `created_at`
6. `loyalty_rewards`: `id`, `user_id`, `milestone_sessions` (5/10/20/30), `reward_type`, `is_claimed`, `claimed_at`

---

## 2-Lane Implementation Breakdown (Total: 32h)

### Phase 1: Foundation & Auth & DB (Backend 4h / Frontend 4h)
- **Lane 1 (Backend):**
  - Init Spring Boot 3 project (Maven/Gradle, Java 21, Spring Data JPA, PostgreSQL, Spring Security).
  - Define all JPA Entities, Enums, DTOs, Repository interfaces.
  - JWT Auth (Login for Host/Member, Guest phone lookup).
- **Lane 2 (Frontend):**
  - Init Vite React TS app, TailwindCSS, Shadcn UI setup.
  - Setup routing, Zustand Auth Store, Axios/Fetch client with JWT interceptor.
  - Mobile bottom navigation & Base Layout.

### Phase 2: Session & Smart Slot Booking + Cọc 30% (Backend 6h / Frontend 6h)
- **Lane 1 (Backend):**
  - Session CRUD API (Host tạo ca, đặt giờ, cài đặt tiền sân/tiền cầu dự kiến).
  - Public Booking API cho khách vãng lai (nhập tên + SĐT -> check slot còn trống -> tạo booking PENDING).
  - VietQR generator service (sinh payload QR kèm số tiền cọc 30% & memo `COC [SESSION_ID] [PHONE]`).
  - API xác nhận cọc (Host duyệt 1 chạm hoặc webhook handler).
- **Lane 2 (Frontend):**
  - Trang chi tiết ca & Form đăng ký slot khách vãng lai (Mobile-friendly).
  - Modal hiển thị VietQR cọc 30% kèm nút tải mã / copy nội dung chuyển khoản.
  - Màn hình quản lý ca của Host (xem danh sách đăng ký, duyệt cọc).

### Phase 3: Secure Check-in (Dynamic QR + GPS) & Host Live Roster (Backend 8h / Frontend 8h)
- **Lane 1 (Backend):**
  - Dynamic QR Token Service: Tạo token HMAC có TTL 15 phút từ lúc bắt đầu ca.
  - Check-in API: Nhận `token` + `user_lat` + `user_lng` -> Validate token hết hạn -> Tính khoảng cách Haversine <= `venue.radius_meters` -> Update `CHECKED_IN`.
  - Dynamic Pricing Engine: Tự động tính `base_fee` theo (Member/Guest, Male/Female, Duration).
  - Host Override API: Cho phép Host chỉnh sửa giờ chơi, cộng trừ tiền phát sinh, ghi chú lý do.
  - Checkout / Settle API: Sinh VietQR thanh toán tiền còn lại (`final_fee - deposit_amount`), hoặc xác nhận tiền mặt.
- **Lane 2 (Frontend):**
  - Host Check-in Screen: Hiển thị mã QR động full-screen trên máy Host (tự làm mới hoặc đếm ngược 15p).
  - Member Check-in Screen: Màn hình quét camera QR (html5-qrcode) + xin quyền GPS trình duyệt.
  - Host Live Roster Dashboard: Thẻ quân số realtime (Đã đến / Chưa đến / Đã cọc / Chưa trả tiền), nút 1-chạm đổi trạng thái & sửa tiền.
  - Màn hình thanh toán cuối ca cho người chơi: Hiển thị hóa đơn chi tiết + VietQR quét trả tiền.

### Phase 4: Kèo đấu 1-Chạm & Dual Leaderboard (Backend 4h / Frontend 4h)
- **Lane 1 (Backend):**
  - Match API: Host chọn 4 người -> Chọn Team A / Team B -> Gửi kết quả `winning_team` (A/B).
  - Win/Loss Calculation: Tự động cập nhật `win_count`, `loss_count` cho 4 user trong transaction.
  - Leaderboard API: 
    - Ranking 1: Chuyên cần (Sort theo `sessions_attended` DESC).
    - Ranking 2: Chiến thần (Sort theo `win_count` DESC hoặc `win_rate` DESC).
- **Lane 2 (Frontend):**
  - Host Matchmaker UI: Chọn nhanh 4 người từ roster đang có mặt trên sân, gán team, bấm nút [Team A Thắng] / [Team B Thắng].
  - Màn hình Bảng Xếp Hạng (Tabs: Chuyên cần / Chiến thần) với huy hiệu Top 1, 2, 3.

### Phase 5: Loyalty, Dashboard Tài Chính & Polish (Backend 6h / Frontend 6h)
- **Lane 1 (Backend):**
  - Loyalty Trigger: Check-in xong tự cộng buổi, chạm mốc 5/10/20/30 tự tạo record `loyalty_rewards`.
  - Session Profit Calculation: `Tổng thu thực tế - (cost_court + cost_shuttlecock) = Net Profit`.
  - Host Financial Report API (Doanh thu ca, tháng).
- **Lane 2 (Frontend):**
  - Trang cá nhân thành viên: Thanh tiến trình tích lũy buổi chơi + Danh sách phần thưởng đã mở khóa / đã đổi.
  - Host Financial Summary Modal: Tổng kết tiền sau khi đóng ca (Tổng thu, Tiền sân, Tiền cầu, Lợi nhuận ròng).
  - Tối ưu UX/UI, animation, dark mode, loading state.

### Phase 6: E2E Integration & Verification (4h)
- Test toàn bộ luồng: Tạo ca -> Đặt slot -> Cọc VietQR -> Quét QR + GPS Check-in -> Bắt kèo -> Chốt bill -> Tính thưởng -> Đóng ca.