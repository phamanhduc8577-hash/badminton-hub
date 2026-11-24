---
phase: 3
title: "Tối ưu Trang Chi tiết Ca & Host Dashboard"
status: pending
priority: P1
effort: "3h"
dependencies: ["phase-02-revamp-session-list.md"]
---

# Phase 3: Tối ưu Trang Chi tiết Ca & Host Dashboard

## Overview
Gom gọn thông tin bảng giá và ca đấu trên `SessionDetailView` thành các khối liền mạch thay vì chia cắt vụn vặt; đồng thời tăng khoảng thở (whitespace), tổ chức lại mật độ các nút bấm trên `HostDashboardView` để thao tác nhanh và chuẩn xác ngoài sân.

## Requirements
- Functional:
  - Giữ nguyên toàn bộ logic tính giá (Cố định / Vãng lai, 2h / Full ca, cọc), quét mã QR điểm danh, thanh toán VietQR và ghi nhận kết quả trận đấu.
  - Giữ nguyên các quyền và bảng điều khiển chia sân, bắt kèo, ghi điểm của Host.
- Non-functional:
  - `SessionDetailView`: Gom bảng giá vỡ vụn thành bảng so sánh 2 cột trực quan (Thành viên vs Khách vãng lai).
  - Tinh giản thẻ MVP ca đấu: hiển thị huy hiệu nhỏ gọn, bỏ văn bản chú thích rườm rà.
  - `HostDashboardView`: Giảm thiểu tình trạng nút bấm dày đặc dính sát nhau; dùng thanh công cụ nhóm (Button groups) có khoảng thở phù hợp với ngón tay trên thiết bị di động.

## Architecture
- `SessionDetailView.tsx`:
  - Khối chi tiết ca: Nhóm Địa điểm, Thời gian, Số sân vào một danh sách thông tin (Data List) có đường kẻ phân cách mảnh thay vì 4 ô hộp xám riêng biệt.
  - Khối Bảng giá: Thiết kế bảng giá 2 cột đối sánh (Thành viên / Vãng lai) với giá Nam / Nữ rõ ràng, làm nổi bật mức giá áp dụng cho chính người dùng đang xem.
  - Thẻ MVP: Banner gọn nhẹ phía trên danh sách người tham gia với điểm số set thắng và phần thưởng.
- `HostDashboardView.tsx`:
  - Khối điều khiển sân: Cấu trúc lại các bảng sân song song (Sân 1, Sân 2...) để rõ ràng người thi đấu mỗi bên (Đội A vs Đội B), nút chọn người chơi và ghi điểm to bản, khó bấm nhầm.
  - Danh sách người tham gia (Roster): Tối ưu các thẻ người chơi (RosterCard) với nút điểm danh nhanh và nhãn tiền cọc/thanh toán rõ ràng.

## Related Code Files
- Modify: `D:/Projects/badminton-hub/frontend/src/views/SessionDetailView.tsx`
- Modify: `D:/Projects/badminton-hub/frontend/src/views/HostDashboardView.tsx`
- Modify: `D:/Projects/badminton-hub/frontend/src/components/host/RosterCard.tsx`

## Implementation Steps
1. Tinh chỉnh `SessionDetailView.tsx`:
   - Làm lại phần Header thông tin ca đấu (bỏ chia vụn hộp).
   - Thiết kế lại bảng giá: dạng bảng 2 cột rõ ràng, có highlight giá của người xem.
   - Thu gọn banner MVP.
2. Tinh chỉnh `HostDashboardView.tsx` và `RosterCard.tsx`:
   - Phân tách khoảng cách (padding/gap) giữa các nút hành động để tránh ấn nhầm ngoài sân cầu lông.
   - Chuẩn hóa typography của bảng tỉ số và danh sách người chơi.
3. Chạy toàn bộ test suites:
   - `npm test -- SessionDetail`
   - `npm test -- HostDashboard`
   - Đảm bảo tất cả các test ca đấu, tiền cọc, bắt kèo đều pass 100%.

## Success Criteria
- [ ] Bảng giá ca đấu rõ ràng, không còn rối mắt và nhiều hộp nhỏ.
- [ ] Host Dashboard thao tác thuận tiện, không bị cảm giác dày đặc nút bấm gây ngợp.
- [ ] 100% các bài test liên quan đến tính toán tiền nong và bắt kèo đều xanh (Exit Code 0).

## Risk Assessment
- Rủi ro: Khâu bắt kèo và sửa hóa đơn có logic phức tạp, nếu sửa nhầm class hoặc DOM hierarchy có thể ảnh hưởng đến các hàm tính toán vị trí.
- Giảm thiểu: Chỉ tái cấu trúc lớp layout và styling, giữ nguyên các component xử lý nghiệp vụ (`OverrideBillSheet`, `CourtSettingsSheet`, `UndoPaymentSheet`).
