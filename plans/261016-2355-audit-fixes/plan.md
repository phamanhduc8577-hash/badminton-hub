# Kế hoạch sửa lỗi sau đợt rà soát — bản hoàn chỉnh (16/10/2026)

**Ngoài phạm vi (giữ nguyên theo yêu cầu):** luồng quên mật khẩu `/auth/forgot-password` và Host reset mật khẩu thành viên về `123456`.
**Đã xác nhận:** `JWT_SECRET` đã đặt trên Render.

## Các quyết định đã chốt

| # | Vấn đề | Chốt | Lý do |
|---|--------|------|-------|
| Q1 | Nút dọn database | **Tắt trên production.** Endpoint chỉ chạy khi biến môi trường `ALLOW_DB_RESET=true` (Render không đặt → luôn trả 404), khi bật vẫn phải gửi chuỗi xác nhận `XOA TAT CA`. Bỏ dòng đặt lại mật khẩu Host `040304`. | Một lần bấm nhầm là mất toàn bộ lịch sử tiền. Giao diện hiện cũng không có nút gọi endpoint này (code thừa `resetDbMutation`). |
| Q2 | Endpoint demo auto-seed | **Xóa hẳn** (backend + nút/mutation frontend). | Ghi PAID/trận/Elo giả lên thành viên thật; không cần cho CLB đang chạy thật. |
| Q3 | Hoàn tác thu tiền | **Chỉ Host, trong vòng 7 ngày sau khi ca kết thúc**, bắt chọn lý do, gửi Telegram báo lại. | Đủ để sửa bấm nhầm tại sân; không cho sửa doanh thu các tháng đã chốt. |
| Q4 | Cửa sổ tự điểm danh QR | **Từ 30 phút trước giờ bắt đầu tới hết ca.** Tính theo giờ ca, tự đúng khi Host dời giờ. | 15 phút làm người đến muộn hợp lệ phải nhờ Host; mã QR vẫn chỉ đúng cho ca đó. |
| Q5 | Số liệu cũ đã bị tính sai | **Sửa từ nay về sau, không tự sửa dữ liệu cũ.** Thêm 1 trang chỉ-đọc cho Host: danh sách lượt *đã thanh toán + có cọc* để đối soát tay nếu muốn. | Không có log cũ để phân biệt cọc thật / cọc bị tự đánh dấu, sửa tự động có thể sai thêm. |
| Q6 | Xóa vĩnh viễn thành viên | **Ẩn danh hóa không hoàn tác** (giữ lịch sử tiền và trận). | Xóa sạch làm giảm doanh thu ca cũ và làm mất trận/lệch LP của người khác. |

## Nguyên tắc thực hiện

- Mỗi đợt = 1 commit riêng. Trước khi push: `gradlew test`, `npm run build`, `vitest run` đều xanh.
- Mỗi lỗi nghiệp vụ có test tái hiện lỗi (đỏ trước, xanh sau khi sửa).
- Cột DB mới thêm theo cách dự án đang dùng: `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` trong `DataInitializer` (kèm `ddl-auto=update`), luôn có giá trị mặc định để dữ liệu cũ chạy được ngay.
- Sau mỗi lần deploy: chờ Render "Live", kiểm tra tay trên điện thoại theo mục "Kiểm tra sau deploy" của đợt đó, rồi mới sang đợt sau.

---

## Đợt 1 — Bảo mật

| # | Lỗi | Cách sửa | File chính |
|---|-----|----------|-----------|
| 1.1 | Mật khẩu Host `040304` viết cứng; dọn DB không cần xác nhận | Theo Q1. Tìm Host theo `role=HOST` thay vì SĐT viết cứng. Xóa `resetDbMutation` thừa ở frontend. | `MemberManagementService`, `MemberController`, `MemberListView` |
| 1.2 | Endpoint demo ghi dữ liệu giả vào thành viên thật | Theo Q2: xóa `autoSeedFullSimulation`, route và mutation frontend. | `SessionService`, `SessionController`, `HostDashboardView` |
| 1.3 | Tài khoản đã xóa vẫn dùng được token cũ 30 ngày; đổi mật khẩu không làm token cũ hết hạn | Filter bỏ qua user `deleted=true`. Thêm cột `users.token_version` (mặc định 0), nhúng vào JWT; tăng khi đổi mật khẩu, bị xóa, bị Host reset mật khẩu. Token thiếu claim (token cũ) coi là version 0 → không ai bị đăng xuất khi deploy. | `JwtAuthenticationFilter`, `JwtProvider`, `User`, `AuthService`, `MemberManagementService` |
| 1.4 | API lấy mã QR cọc/thanh toán không cần đăng nhập, đổi ID là ra SĐT | Thành viên: phải đăng nhập và là chủ lượt đăng ký (hoặc Host). Khách vãng lai đặt công khai: gửi kèm SĐT đã đặt, server so khớp. Nội dung chuyển khoản đổi sang mã `SF<participantId>` thay cho SĐT; sửa luôn lỗi memo `COC 12 null`. Cập nhật frontend gọi kèm thông tin xác thực. | `SessionController`, `SessionService`, `SecurityConfig`, `SessionDetailView` |
| 1.5 | Danh sách người tham gia trả SĐT đầy đủ cho mọi người | Che SĐT ở server khi người xem không phải Host; frontend bỏ tự che. | `CheckinAndPricingService.toParticipantResponse`, `SessionService` |
| 1.6 | Giới hạn đăng nhập sai bị lách bằng header `X-Forwarded-For` | Lấy IP ở phần tử cuối của header (do proxy Render thêm). Thêm giới hạn theo SĐT: 10 lần sai / 15 phút thì khóa tạm. Không đụng luồng quên mật khẩu. | `RateLimitingFilter`, `AuthService.login` |
| 1.7 | Sai quyền trả 400; lỗi 500 lộ thông tin nội bộ | `AccessDeniedException` → 403; lỗi không lường trước → 500 với thông báo chung, chi tiết chỉ ghi log. Lỗi nghiệp vụ (RuntimeException có thông báo tiếng Việt) giữ 400 như cũ. | `GlobalExceptionHandler` |

**Dữ liệu:** thêm `users.token_version INT DEFAULT 0`.
**Test:** user deleted bị chặn; token_version cũ bị chặn; token cũ không claim vẫn dùng được; quyền gọi QR (chủ / người khác / Host / khách đúng-sai SĐT); SĐT bị che với người không phải Host; khóa sau 10 lần sai; 403 cho member gọi API Host.
**Kiểm tra sau deploy:** đăng nhập bình thường; mở QR cọc của chính mình được; mở link QR của người khác bị chặn; danh sách người tham gia thấy SĐT bị che (Host vẫn thấy đủ).

---

## Đợt 2 — Tiền & nghiệp vụ

| # | Lỗi | Cách sửa | File chính |
|---|-----|----------|-----------|
| 2.1 | Gom công thức giá (đang copy 4 nơi) | Tạo `PricingCalculator`: giá gốc theo hạng thành viên/giới tính/gói 2h + voucher %. Mọi nơi tính giá dùng chung. Không cho tạo/sửa ca với giá full ca bị trống. | mới `PricingCalculator.java`; `SessionService`, `MemberManagementService`, `GenderChangeService` |
| 2.2 | Cọc chưa nhận vẫn bị trừ vào tiền còn lại; "đã thu" tự đánh dấu cọc → thu thiếu, báo cáo dư | Tiền còn lại chỉ trừ cọc khi cọc `PAID`. `settlePayment` không tự đổi trạng thái cọc. | `SessionParticipant`, `CheckinAndPricingService.settlePayment` |
| 2.3 | Thu tiền 2 lần (Telegram gửi 2 lần), không hoàn tác được | Chặn thu lượt đã PAID. Thêm API + nút **Hoàn tác thu tiền** theo Q3; lưu `paid_at`, `paid_by`. | `CheckinAndPricingService`, `SessionController`, `HostDashboardView` |
| 2.4 | Sửa ca (kể cả chỉ sửa tiêu đề) tính lại giá cả người đã thanh toán, xóa điều chỉnh tay | Chỉ tính lại khi trường giá thay đổi; bỏ qua lượt PAID / ABSENT / FORFEITED; giữ điều chỉnh tay, tính lại voucher %. | `SessionService.updateSession` |
| 2.5 | Duyệt/hạ cấp thành viên tính lại giá toàn bộ lịch sử; lỗi bị nuốt | Chỉ áp lượt chưa thanh toán, chưa vắng; dùng `PricingCalculator`; bỏ `catch (Exception ignored)`. | `MemberManagementService.syncMemberPricingForActiveSessions` |
| 2.6 | Tự điểm danh bấm đúp cộng 2 buổi, ghi đè dữ liệu user | Khóa dòng (`findByIdForUpdate`), load lại user trong transaction, dùng `recalculateAttendance` như luồng Host; chặn lượt ABSENT. | `CheckinAndPricingService.memberCheckin` |
| 2.7 | Cửa sổ tự điểm danh 15 phút; dời giờ ca làm QR hết hạn sai | Theo Q4: so với `startTime − 30′ … endTime` của ca, bỏ phụ thuộc `tokenExpiresAt`. Sửa chữ "Mã làm mới mỗi 15 phút" trên giao diện Host. | `CheckinAndPricingService.memberCheckin`, `HostDashboardView` |
| 2.8 | "Chỉ đánh 2 tiếng" lúc điểm danh không có tác dụng | Áp giá 2h khi điểm danh nếu ca có giá 2h và lượt chưa thanh toán. Ca không có giá 2h → ẩn lựa chọn. | `CheckinAndPricingService.memberCheckin`, `SessionDetailView` |
| 2.9 | Xóa người đã thanh toán làm mất tiền khỏi báo cáo; hoàn voucher nhầm mốc | Không cho xóa lượt PAID (phải hoàn tác thu trước). Lưu `voucher_reward_id` trên lượt đăng ký, hoàn đúng phần thưởng đó. | `SessionService.removeParticipant`, `SessionParticipant` |
| 2.10 | Báo cáo tháng không có ca lại hiện doanh thu toàn bộ; top người chơi tính sai | Tháng không có ca → báo cáo rỗng; lọc theo `startTime` trong tháng; top người chơi tính theo trận trong tháng. | `ReportService.getMonthlyFinancialReport` |
| 2.11 | Sửa hóa đơn ra số âm / sửa lượt đã thanh toán; xác nhận cọc lại lượt đã bị giữ cọc | Kiểm tra trạng thái và `finalFee ≥ 0`. | `CheckinAndPricingService.hostOverrideBill`, `SessionService.confirmDeposit` |
| 2.12 | Trang đối soát (Q5) | Trang chỉ-đọc cho Host: các lượt PAID có tiền cọc > 0 trước ngày deploy, kèm tên, ca, số tiền. | `ReportController`, `ReportService`, `HostOverviewView` |

**Dữ liệu:** thêm `session_participants.voucher_reward_id BIGINT NULL`, `paid_at TIMESTAMP NULL`, `paid_by BIGINT NULL`.
**Test:** tiền còn lại theo từng trạng thái cọc; thu lần 2 bị chặn; hoàn tác trong/ngoài 7 ngày; sửa tiêu đề không đổi giá; sửa giá bỏ qua lượt PAID và giữ điều chỉnh tay; duyệt cố định không đổi lượt cũ; điểm danh 2 lần chỉ +1 buổi; cửa sổ điểm danh trước 30′/sau giờ kết thúc; xóa lượt PAID bị chặn; voucher hoàn đúng mốc; báo cáo tháng rỗng.
**Kiểm tra sau deploy:** tạo 1 ca thử → khách lần đầu đặt (có cọc) → thu tiền khi chưa xác nhận cọc thì số tiền đủ, không trừ 20k → thu lại bị chặn → hoàn tác → thu lại được.

---

## Đợt 3 — Mobile cho thành viên

| # | Lỗi | Cách sửa | File chính |
|---|-----|----------|-----------|
| 3.1 | iPhone tự phóng to khi bấm ô nhập (gần mọi form) | CSS chung: `input, select, textarea { font-size: 16px }` dưới 640px; `CurrencyInput` mặc định `text-base`. Áp cho cả màn hình Host. | `index.css`, `CurrencyInput` |
| 3.2 | Popup không cuộn được, nút xác nhận bị khuất bởi bàn phím / iPhone nhỏ | Tạo `BottomSheet` dùng chung (giống popup giới tính): trượt từ dưới, `max-h-[92dvh]`, cuộn được, nút dính đáy, chừa vùng home iPhone, chạm nền/Esc để đóng, có `role="dialog"`. Thay cho popup cọc VietQR, điểm danh, chọn khung giờ, hóa đơn, tiền mặt, mở quà. | mới `components/BottomSheet.tsx`; `SessionDetailView`, `LoyaltyView` |
| 3.3 | Quét QR lỗi không báo gì; scanner tự khởi động lại, camera không tắt | Lỗi → toast + mở form nhập mã tay; nút "Nhập mã bằng tay" mở thẳng form; giữ callback bằng ref, đợi camera khởi động xong mới tắt; nút Thử lại khi bị từ chối quyền camera; khung ngắm khớp vùng quét. Ô nhập mã: tắt tự sửa chữ, tự viết hoa. | `QrCameraScanner`, `SessionDetailView` |
| 3.4 | Nút thanh toán không có trạng thái chờ; tiền mặt báo thành công khi API lỗi | Thêm trạng thái đang xử lý + khóa nút; chỉ báo khi API thành công. | `SessionDetailView` |
| 3.5 | Không tự cập nhật (chuyển cọc xong quay lại vẫn "đang chờ") | Tải lại khi quay lại app; tự tải lại 15s khi đang chờ cọc hoặc ca đang diễn ra. | `App.tsx`, `SessionDetailView` |
| 3.6 | Thanh menu dưới bị thanh home iPhone đè; footer bị che; mục menu nhỏ | `viewport-fit=cover`, padding `safe-area-inset-bottom`, mỗi mục `flex-1 min-h-11`, ẩn footer trên mobile. | `index.html`, `Layout` |
| 3.7 | Header tràn ở 375px; nút đăng xuất sát avatar | Ẩn dòng phụ trên mobile, cắt chữ; đăng xuất chuyển vào popup hồ sơ, có xác nhận. | `Layout`, `ProfileModal` |
| 3.8 | Đăng nhập thiếu `autocomplete` (không gợi ý lưu mật khẩu); nút nhỏ | Thêm `autoComplete`/`name`; tăng vùng bấm. Lỗi hiển thị gần nút gửi. | `LoginView` |
| 3.9 | Trang chủ: phần giới thiệu đẩy danh sách ca quá sâu; nút lọc nhỏ; class `no-scrollbar`, `xs:` không tồn tại | Mobile ẩn mascot lớn + lưới tính năng; nút lọc ≥40px; định nghĩa `no-scrollbar`, thay `xs:` bằng `sm:`. | `SessionListView`, `index.css` |
| 3.10 | Lịch Đổi thưởng tràn ô ở 375px | Mobile chỉ hiện số ngày + dấu tích; chạm ngày để xem chi tiết ca; hiện KPI chuyên cần trên mobile; popup mở quà dùng BottomSheet. | `LoyaltyView` |
| 3.11 | Danh sách người tham gia cuộn lồng trong trang | Bỏ `max-h` trên mobile. | `SessionDetailView` |
| 3.12 | Bảng xếp hạng: nút tab tràn chữ; thông tin rank chỉ có khi rê chuột | Nhãn ngắn trên mobile; chạm huy hiệu rank mở bảng bậc rank. | `LeaderboardView` |
| 3.13 | Form hồ sơ có thể xóa chữ đang gõ (lỗi từ lần sửa giới tính) | Chỉ reset form khi mở popup. Nút ẩn/hiện mật khẩu to hơn, thêm `autocomplete`. | `ProfileModal` |
| 3.14 | Toast nằm giữa màn hình che nút; giờ điểm danh hiện kiểu "7:05:32 PM" | Toast lên trên cùng, `aria-live`; định dạng giờ `vi-VN` HH:mm. | `ToastProvider`, `SessionDetailView` |

**Test (vitest):** BottomSheet (mở/đóng, chạm nền, Esc); quét QR lỗi hiện toast + mở form tay; nút thanh toán khóa khi chờ, tiền mặt lỗi không báo thành công; ProfileModal không mất chữ khi dữ liệu user cập nhật; menu dưới có safe-area.
**Kiểm tra sau deploy:** iPhone Safari + Android Chrome, màn 375px: bấm ô đăng nhập không phóng to; mở popup cọc trên iPhone nhỏ thấy nút xác nhận; quét mã sai thấy báo lỗi; menu dưới không bị thanh home đè.

---

## Đợt 4 — Mobile cho Host (dùng tại sân)

| # | Lỗi | Cách sửa | File chính |
|---|-----|----------|-----------|
| 4.1 | Bảng điểm danh 9 cột phải kéo ngang; nút điểm danh ~24px | Mobile: **thẻ từng người** — tên + nhãn, nút "Đã đến" ≥44px, số tiền còn lại, nút "Thu tiền" rộng, Sửa/Xóa/Hoàn tác thu trong menu "⋯". Desktop giữ bảng. Lọc nhanh: Chưa đến / Chưa trả tiền. | `HostDashboardView` (tách `components/host/RosterCard.tsx`) |
| 4.2 | Hủy điểm danh: nút ~21px, dùng `window.confirm` | Nút có chữ trong menu "⋯", xác nhận bằng BottomSheet. | `HostDashboardView` |
| 4.3 | Bấm điểm danh 1 người khóa nút mọi người, không phản hồi | Trạng thái chờ theo từng người + cập nhật ngay trên giao diện, lỗi thì trả lại. | `HostDashboardView` |
| 4.4 | Tab không dính; banner quá cao | Tab dính đầu màn hình; banner thu gọn trên mobile (QR, chỉ số vào nút mở rộng). | `HostDashboardView` |
| 4.5 | Tab Trận đấu: phải cuộn qua danh sách người chơi mới tới ghép sân | Khu ghép sân + nút ghi kết quả lên đầu; bảng số trận từng người thu gọn. Lịch sử trận không cuộn lồng. | `HostDashboardView` |
| 4.6 | Ghi người thắng 1 chạm không hoàn tác; nút "Sửa" ~20px; nút xóa sân sát tab sân | Toast "Hoàn tác" 5 giây (gọi xóa trận vừa ghi); nút Sửa to hơn; xóa sân chuyển vào cài đặt sân. | `HostDashboardView` |
| 4.7 | Chọn người chơi: phóng to, bàn phím Android che danh sách, iOS không đóng khi chạm ngoài | Không tự focus trên thiết bị cảm ứng; dùng `pointerdown`; nút xóa ≥44px; trigger là `<button>`. | `PlayerSelect` |
| 4.8 | Popup sửa hóa đơn: không cuộn, lỗi im lặng, bấm +/- tự chèn 10.000đ | BottomSheet; báo lỗi; bỏ số mặc định; nút đổi dấu tách dòng riêng. | `HostDashboardView` |
| 4.9 | "Đã nhận cọc" bấm đúp, lỗi im lặng; popup xóa người đóng trước khi xong; thêm sân báo thành công trước khi xong | Khóa nút khi chờ + toast lỗi; đóng popup trong `onSettled`; toast thành công trong `onSuccess`. | `HostDashboardView` |
| 4.10 | Dashboard không tự cập nhật người tự điểm danh / chuyển khoản | Tự tải lại 15s khi ca đang diễn ra; nút "Làm mới" tải lại cả trận + báo cáo. | `HostDashboardView` |
| 4.11 | Cài đặt sân: ô số slot nhập lỗi ("816"), xóa trống tự về 8 | Ô số giữ dạng chuỗi, validate trước khi lưu, `inputMode="numeric"`. | `HostDashboardView` |
| 4.12 | Trang Thành viên: bảng 8 cột, nút nhỏ, Xóa sát Level Up; nút Khôi phục khó tìm; popup rank không cuộn | Mobile dùng thẻ + menu hành động (BottomSheet); nút Khôi phục lên thanh công cụ; popup rank dùng BottomSheet; `window.confirm` tối ưu ảnh → BottomSheet. | `MemberListView` |
| 4.13 | Tạo ca: số sân và tên sân lệch; ô số lỗi; tiêu đề "Tiền cọc 30%" sai | Tự sinh tên sân theo số sân (sửa tay được); gợi ý slot = sân × 8; ô số dạng chuỗi + validate; sửa tiêu đề. | `CreateSessionView` |

**Test (vitest):** thẻ điểm danh — bấm "Đã đến" gọi đúng API, chỉ thẻ đó bị khóa khi chờ; hoàn tác thu tiền; toast hoàn tác trận gọi xóa trận; số sân ↔ tên sân đồng bộ; ô slot không nhận "816".
**Kiểm tra sau deploy:** chạy thử 1 ca thật trên điện thoại Host: điểm danh 5 người, thu tiền 2 người (1 tiền mặt, 1 QR), hoàn tác 1, ghép 1 trận và hoàn tác kết quả.

---

## Đợt 5 — Nghiệp vụ còn lại & hiệu năng

| # | Lỗi | Cách sửa | File chính |
|---|-----|----------|-----------|
| 5.1 | Sửa/xóa 1 trận làm sai LP cả 4 người | Lưu LP thay đổi của từng người trên mỗi trận (cột mới). Sửa/xóa = đảo ngược đúng phần đó rồi áp lại kết quả mới. Trận cũ chưa có dữ liệu: tính lại theo thứ tự thời gian toàn CLB thay cho từng người. | `MatchService`, `Match` |
| 5.2 | Trạng thái ca không bao giờ cập nhật; không có hủy ca | Backend tính trạng thái theo giờ cho mọi API (sắp diễn ra / đang diễn ra / đã kết thúc) + API **Hủy ca** cho Host (lưu CANCELLED, báo Telegram, lượt chưa thanh toán bị hủy). "Ca sắp tới" lọc theo `endTime > now`. Frontend dùng chung 1 hàm trạng thái; ẩn nút tham gia khi ca hủy/kết thúc. | `SessionService`, `SessionController`, `lib/sessionStatus.ts`, các view |
| 5.3 | Khách đặt công khai trùng SĐT thành viên tạo bản ghi trùng → không điểm danh được; vắng rồi không đặt lại được | Kiểm tra trùng theo cả user và SĐT; đặt công khai bằng SĐT của tài khoản thành viên → báo "SĐT đã có tài khoản, vui lòng đăng nhập". Lượt cũ ABSENT thì cho đặt lại (dùng lại dòng cũ). Thêm chỉ mục duy nhất (session_id, user_id) **sau khi** chạy truy vấn kiểm tra DB không còn bản ghi trùng (nếu có, báo bạn xử lý trước). | `SessionService.bookPublicSlot/memberJoinSession`, `DataInitializer` |
| 5.4 | Sửa địa điểm 1 ca đổi tên địa điểm mọi ca khác | Tìm/tạo venue mới thay vì sửa venue dùng chung. | `SessionService.updateSession` |
| 5.5 | Giá 2h hiện trên popup khác giá bị tính; không xóa được giá 2h | Backend trả giá dự kiến cho từng lựa chọn (full ca / 2h đầu / 2h cuối) theo người xem; frontend chỉ hiển thị. Cho phép xóa giá 2h khi sửa ca. | `SessionService`, `SessionResponse`, `SessionDetailView`, `SessionListView` |
| 5.6 | Tiền cọc "20.000đ" viết cứng; điều kiện miễn cọc trên giao diện khác backend | Hiện `session.depositAmount`; backend trả cờ `requiresDeposit` cho người xem. | `SessionService`, `SessionDetailView` |
| 5.7 | Tải ca lỗi → "Đang tải" mãi | Màn hình lỗi + nút Thử lại (trang chi tiết ca và dashboard Host). | `SessionDetailView`, `HostDashboardView` |
| 5.8 | Mã QR trong URL làm popup điểm danh mở lại liên tục | Xóa `?token=` khỏi URL sau khi xử lý; chặn mở lại bằng ref. | `SessionDetailView` |
| 5.9 | Đăng xuất không xóa dữ liệu tạm (máy dùng chung thấy dữ liệu Host); token hết hạn không quay về đúng trang | `queryClient.clear()` khi đăng xuất/401; chuyển về `/login?redirect=<trang hiện tại>`; route Host cũng gửi redirect. | `App.tsx`, `lib/api.ts`, `useAuthStore` |
| 5.10 | Thiếu làm mới dữ liệu sau tham gia / điểm danh / sửa ca | Bổ sung invalidate: danh sách ca, hồ sơ, phần thưởng, lịch sử điểm danh, báo cáo. | các view |
| 5.11 | File JS 1MB, mở chậm trên 4G | Lazy load trang Host, máy quét QR, GiftGraphic, qrcode. Mục tiêu file chính < 500KB. | `App.tsx`, `vite.config.ts` |
| 5.12 | Tải toàn bộ ca / người dùng mỗi lần, nhiều truy vấn lặp | Gộp truy vấn đếm slot cho danh sách ca; leaderboard lọc/sắp xếp bằng SQL, bỏ tài khoản GUEST/đã xóa; `@Transactional(readOnly)` cho báo cáo. | `SessionService`, `LeaderboardService`, `ReportService` |
| 5.13 | Múi giờ phụ thuộc code khởi động | Thêm `TZ=Asia/Ho_Chi_Minh` và `-Duser.timezone` trong Dockerfile. | `Dockerfile` |
| 5.14 | Thời gian từ server không kèm múi giờ → điện thoại khác múi giờ hiển thị sai | Frontend parse thời gian ca theo giờ Việt Nam (+07:00) ở 1 hàm chung. | `lib/dateUtils.ts` |

**Dữ liệu:** thêm cột LP thay đổi cho từng người trên `matches` (4 cột INT NULL); chỉ mục duy nhất (session_id, user_id) có điều kiện như 5.3.
**Test:** sửa kết quả 1 trận chỉ đổi LP đúng phần trận đó; xóa trận trả LP về như trước; ca đã qua không còn trong "sắp tới"; hủy ca; đặt công khai bằng SĐT thành viên bị chặn; đặt lại sau khi vắng; giá dự kiến khớp giá bị tính (dùng chung `PricingCalculator`); đăng xuất xóa cache; bundle < 500KB.

---

## Đợt 6 — Xóa vĩnh viễn thành viên (tính năng mới, theo Q6)

Hiện "Xóa" chỉ là xóa mềm: tài khoản vào danh sách Khôi phục, SĐT vẫn bị giữ nên người đó không đăng ký lại được. Tài khoản đang được tham chiếu bởi lượt đăng ký ca (có tiền), trận đấu (có người khác), phần thưởng và ca do Host tạo.

**Cách làm — ẩn danh hóa, không hoàn tác:**
- Chỉ áp dụng cho tài khoản đang trong danh sách đã xóa và không phải Host.
- Xóa thông tin cá nhân: tên → "Thành viên đã xóa #id", SĐT → giá trị ngẫu nhiên không đăng nhập được (SĐT thật được giải phóng để đăng ký lại), xóa avatar, mật khẩu; tăng `token_version`.
- Lượt đăng ký chưa thanh toán ở ca chưa diễn ra → xóa (trả slot). Lượt đã thanh toán / ca đã qua → giữ số tiền, xóa `guestName/guestPhone` trên dòng đó.
- Phần thưởng chưa nhận → xóa; đã trao → giữ để đối soát quà.
- Trận đấu giữ nguyên, LP người khác không đổi; tên hiển thị "Thành viên đã xóa".
- Đánh dấu `purged=true` → ẩn khỏi mọi danh sách (thành viên, đã xóa, leaderboard, ghép trận).
- API `DELETE /api/members/{id}/permanent` (chỉ Host), chạy trong 1 transaction.
- Giao diện: popup Khôi phục, mỗi dòng có nút "Xóa vĩnh viễn" → BottomSheet cảnh báo đỏ, phải gõ đúng tên thành viên mới bật nút xác nhận.

**Dữ liệu:** thêm `users.purged BOOLEAN DEFAULT FALSE`.
**Test:** không còn tên/SĐT thật; SĐT cũ đăng ký lại được; giữ tiền lượt PAID; xóa lượt chưa thanh toán ca sắp tới; chặn khi chưa xóa mềm / là Host; token cũ bị vô hiệu; báo cáo doanh thu không đổi trước/sau; nút xác nhận chỉ bật khi gõ đúng tên.

---

## Thứ tự & ước lượng

| Đợt | Nội dung | Quy mô | Phụ thuộc |
|-----|----------|--------|-----------|
| 1 | Bảo mật | ~1 buổi | — |
| 2 | Tiền & nghiệp vụ | ~1.5 buổi | — |
| 3 | Mobile thành viên | ~1.5 buổi | tạo `BottomSheet` dùng cho đợt 4 |
| 4 | Mobile Host | ~2 buổi | 2.3 (hoàn tác thu tiền), 3.2 (BottomSheet) |
| 5 | Nghiệp vụ còn lại & hiệu năng | ~2 buổi | 2.1 (`PricingCalculator`) |
| 6 | Xóa vĩnh viễn thành viên | ~0.5 buổi | 1.3 (`token_version`) |

Tổng ~8.5 buổi. Đợt 1 → 2 → 3 → 4 → 5 → 6; đợt 6 có thể làm ngay sau đợt 1 nếu bạn cần sớm.
