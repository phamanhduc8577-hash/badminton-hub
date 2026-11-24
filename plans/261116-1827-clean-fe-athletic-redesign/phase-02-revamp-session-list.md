---
phase: 2
title: "Đại tu Trang chủ & Thẻ Ca Đánh"
status: pending
priority: P1
effort: "3h"
dependencies: ["phase-01-start.md"]
---

# Phase 2: Đại tu Trang chủ & Thẻ Ca Đánh

## Overview
Xóa bỏ khối Hero AI quảng cáo sáo rỗng và mascot vịt 180px khổng lồ. Thay thế bằng widget tóm tắt ca đấu tiếp theo của người dùng và thiết kế lại card ca đánh theo chuẩn thể thao: thông số rõ ràng, ít chữ thừa, dễ nhìn khi đang ở sân.

## Requirements
- Functional: Bảo toàn 100% logic lọc ca (`ALL`, `MY_SESSIONS`, `ACTIVE_UPCOMING`, `COMPLETED`), chức năng chuyển trang chi tiết, modal sửa ca của Host.
- Non-functional:
  - Cắt bỏ hoàn toàn slogan sáo rỗng: "Quản trị ca đấu & điểm danh thông minh Pro Match System...".
  - Bỏ con vịt khổng lồ 180px cùng khung "Official Mascot" chiếm nửa màn hình.
  - Mỗi thẻ ca đánh chỉ hiển thị tối đa 1-2 huy hiệu (badge) quan trọng nhất (ví dụ: "Đã đăng ký" hoặc "Đang diễn ra"), không nhồi nhét 4-5 badge cùng lúc.
  - Tăng độ tương phản cho khung giờ, số lượng slot và địa điểm thi đấu.

## Architecture
- `SessionListView.tsx`:
  - Khu vực trên cùng (Top section): Nếu user đã đăng ký ca sắp tới, hiển thị trực quan card "Ca tiếp theo của bạn" kèm đếm ngược hoặc nút xem chi tiết nhanh. Nếu chưa đăng ký, hiển thị banner chào ngắn gọn kèm nút "Xem lịch ca".
  - Bộ lọc trạng thái: Tinh giản thành thanh tab ngang (Pill tabs) phẳng, rõ ràng số lượng ca.
  - Danh sách ca (Session Card):
    - Dòng 1: Trạng thái duy nhất + Tên sân & Thời gian (VD: `18:00 - 20:00 • Thứ 7, 18/11`).
    - Dòng 2: Tiêu đề ca & Địa điểm thi đấu kèm icon.
    - Dòng 3: Thanh tiến độ slot trực quan (VD: `6/8 chỗ` kèm thanh progress bar mảnh).
    - Dòng 4: Giá vé tối giản + Nút xem chi tiết / Đăng ký.

## Related Code Files
- Modify: `D:/Projects/badminton-hub/frontend/src/views/SessionListView.tsx`

## Implementation Steps
1. Gỡ bỏ Hero banner cồng kềnh (khối chứa `Smash Champion Duck`, mascot 180px, các khẩu hiệu marketing AI).
2. Xây dựng khối "Ca tiếp theo của bạn" (Your Next Session) thông minh cho user đã đăng nhập: tóm tắt ca gần nhất đã đăng ký, giờ ra sân, địa chỉ.
3. Tái cấu trúc thẻ ca đánh `SessionCard`:
   - Dọn sạch badge rác và hiệu ứng `animate-ping` lòe loẹt không cần thiết.
   - Thêm thanh hiển thị slot trực quan (progress bar) giúp nhận biết ca đầy hay còn chỗ trong 1 giây.
   - Hiển thị mức giá tóm tắt dễ hiểu (VD: `Từ 70.000đ`).
4. Chạy test `SessionListView.test.tsx` và `SessionListEdit.test.tsx` để bảo đảm các hành động click, lọc và quyền Host không bị ảnh hưởng.

## Success Criteria
- [ ] Trang chủ gọn gàng, vào trang thấy ngay lịch các ca đấu mà không cần cuộn qua khối quảng cáo vô nghĩa.
- [ ] Thẻ ca đấu dễ đọc, nắm bắt thông tin giờ, sân, slot trống trong vòng 2 giây.
- [ ] Toàn bộ test của SessionListView đều vượt qua (Exit Code 0).

## Risk Assessment
- Rủi ro: Các test kiểm tra text cụ thể trong Hero ("Quản trị ca đấu") có thể bị fail.
- Giảm thiểu: Rà soát `src/test/SessionListView.test.tsx` và tinh chỉnh test matcher để phù hợp với nội dung mới mang tính thể thao.
