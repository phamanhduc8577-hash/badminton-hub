# 🏸 SmashFlow: Web App Quản lý & Điểm danh Câu Lông (Badminton Club Management)

## 1. Tổng quan dự án (Project Overview)
- **Tên dự án:** SmashFlow
- **Mục tiêu:** Xây dựng Web App tối ưu giao diện mobile-first (trải nghiệm dưới 5 giây) nhằm tự động hóa quy trình điểm danh, tính tiền linh hoạt, chống "bỏ bom" slot và thúc đẩy gắn kết cộng đồng thông qua các cơ chế đổi thưởng và xếp hạng.
- **Đối tượng sử dụng:** 
  - **Host (Quản lý):** Quản lý quân số, dòng tiền, chốt ca tự động, duyệt cọc.
  - **Thành viên cố định:** Gắn bó lâu năm, check-in nhanh, tích lũy buổi chơi nhận quà, tham gia bảng xếp hạng.
  - **Khách vãng lai:** Đăng ký slot qua link web, cọc giữ chỗ trước 30%.

---

## 2. Phân hệ nghiệp vụ cốt lõi (Core Business Logic)

### A. Quản lý Vào/Ra sân (Check-in & Check-out Flow)
- **Check-in đầu ca:** Quét mã QR tại sân để xác nhận có mặt (1 chạm), ghi nhận thời gian bắt đầu.
- **Check-out cuối ca:** Hệ thống tự động ghi nhận thời gian thực tế (xử lý linh hoạt cho người về sớm hoặc đánh quá giờ).

### B. Ma trận giá tự động & Thanh toán (Dynamic Pricing & Settle)
- **Cấu trúc giá động:** Tự động áp giá dựa trên hồ sơ người dùng:
  - *Cố định vs. Vãng lai*
  - *Nam vs. Nữ* (trợ giá cho nữ)
  - *Thời lượng chơi:* 2 tiếng hoặc 3 tiếng.
- **Cộng dồn phát sinh:** Tích hợp tiền nước, quấn cán, cầu tiêu hao vào chung hóa đơn chốt ca.
- **Phương thức thanh toán đa dạng:**
  - *VietQR động:* Tự sinh mã QR đúng số tiền và nội dung chuyển khoản.
  - *Tiền mặt:* Host bấm 1 chạm xác nhận "Đã thu tiền mặt".
  - *Ví trả trước:* Trừ trực tiếp vào số dư nạp trước (dành cho thành viên ruột).

### C. Quản lý Slot & Chống "Bỏ bom" (Slot & Deposit)
- **Poll thông minh cho thành viên cố định:** Hàng tuần gửi link web, thành viên bấm chọn `[Đi]` hoặc `[Bận]` để Host chuẩn bị số lượng cầu chính xác.
- **Đăng ký & Cọc 30% cho khách vãng lai:** Khách đăng ký qua link công khai, hệ thống yêu cầu quét VietQR cọc trước 30% để xác nhận giữ chỗ, phần còn lại thanh toán nốt cuối buổi.

### D. Tích lũy điểm danh & Đổi thưởng (Loyalty & Gamification)
- **Thanh tiến trình buổi chơi:** Tự động cộng dồn số buổi tham gia.
- **Mốc đổi thưởng:** Các mốc quen thuộc (5, 10, 20, 30 buổi) tương ứng với quấn cán, nước thể thao, voucher giảm giá hoặc ống cầu.

### E. Cắp kèo đấu & Hệ thống Đa Ranking (Matchmaking & Dual Leaderboards)
- **Ghi nhận tỷ số siêu tốc:** Chọn nhanh 4 người trên sân, chia Team A / Team B và nhập tỷ số nhanh sau trận đấu.
- **Hệ thống 2 Bảng xếp hạng độc lập:**
  - *Ranking 1 (Chuyên cần):* Dựa trên số buổi đi đều đặn (quà thiết thực, ai cũng có cơ hội).
  - *Ranking 2 (Chiến thần thắng trận / Elo):* Dành cho anh em thích cạnh tranh, vinh danh tay vợt thắng nhiều trận nhất (phần thưởng lớn hoặc đặc quyền).

### F. Bảng điều khiển vận hành cho Host (Host Dashboard)
- **Live Roster:** Giám sát quân số thời gian thực (ai đã đến, ai chưa check-out, ai chưa thanh toán).
- **Instant Settle:** Quyết toán tức thì cuối ca (`Tổng thu - Chi phí sân/cầu = Lợi nhuận ròng`).
- **Quản lý kho:** Kiểm soát số lượng cầu và nước tồn tại sân.

---

## 3. Kiến trúc thiết kế hệ thống (UML 9 Diagrams Mapping)

Để phục vụ cho việc phát triển phần mềm và làm tài liệu đồ án, dự án được quy hoạch qua 9 biểu đồ UML tiêu chuẩn:
1. **Use Case Diagram:** Xác định Actor (Host, Thành viên, Vãng lai) và các chức năng hệ thống.
2. **Class Diagram:** Thiết kế cơ sở dữ liệu và các Entity cốt lõi (`User`, `Session`, `Booking`, `Transaction`, `MatchResult`, `RewardMilestone`).
3. **Activity Diagram:** Mô tả luồng hoạt động chi tiết (Ví dụ: Luồng Check-out & Thanh toán).
4. **Sequence Diagram:** Mô tả giao tiếp theo thời gian thực (Ví dụ: Luồng sinh VietQR cọc 30% cho khách vãng lai).
5. **State Machine Diagram:** Quản lý vòng đời của một slot đặt sân (`Pending Deposit` -> `Confirmed` -> `Checked-In` -> `Completed`).
6. **Component Diagram:** Phân chia các module phần mềm (Frontend, Backend Spring Boot, Database, External APIs).
7. **Deployment Diagram:** Mô tả hạ tầng triển khai trên Cloud (Render/AWS + Supabase/MySQL).
8. **Package Diagram:** Cấu trúc phân tầng thư mục mã nguồn (`controller`, `service`, `repository`, `entity`, `config`).
9. **Communication Diagram:** Quan hệ không gian giữa các đối tượng khi cập nhật tỷ số trận đấu & Elo.