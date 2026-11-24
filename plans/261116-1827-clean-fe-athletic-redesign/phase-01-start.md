---
phase: 1
title: "Chuẩn hóa Design Tokens, Typography & Layout Shell"
status: pending
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1: Chuẩn hóa Design Tokens, Typography & Layout Shell

## Overview
Dọn sạch các lớp style kính mờ cồng kềnh, chuẩn hóa lại hệ thống font chữ và lược bỏ các slogan sáo rỗng trên header/footer để app mang đúng tinh thần thể thao gọn gàng.

## Requirements
- Functional: Giữ nguyên toàn bộ logic điều hướng, xác thực và trạng thái profile của user. Nền sân `BadmintonCourtBg` giữ lại theo mong muốn người dùng nhưng tối ưu độ mượt.
- Non-functional: 
  - Loại bỏ hoàn toàn cỡ chữ siêu nhỏ (`text-[9px]`, `text-[10px]`, `text-[11px]`). Cỡ chữ nhỏ nhất là `text-xs` (12px).
  - Giảm thiểu `backdrop-filter: blur(28px)` gây giật khung hình trên thiết bị di động.
  - Bỏ các từ ngữ "AI sáo rỗng" trên thanh điều hướng và footer.

## Architecture
- `index.css`: Cập nhật `.saas-card` sang thiết kế Clean Athletic Card (nền trắng sạch `bg-white/95`, viền mảnh `border-slate-200`, đổ bóng tự nhiên `shadow-sm`).
- `Layout.tsx`: Tinh giản header. Giữ mascot nhỏ làm biểu tượng nhận diện cạnh tên CLB; bỏ các tag `Pro`, slogan rườm rà. Chỉnh sửa footer tối giản.
- `BadmintonCourtBg.tsx`: Giữ nền sân badminton, cân chỉnh độ tương phản để nội dung phía trên nổi bật và dễ đọc ngoài trời.

## Related Code Files
- Modify: `D:/Projects/badminton-hub/frontend/src/index.css`
- Modify: `D:/Projects/badminton-hub/frontend/src/components/Layout.tsx`
- Modify: `D:/Projects/badminton-hub/frontend/src/components/BadmintonCourtBg.tsx`

## Implementation Steps
1. Điều chỉnh `src/index.css`: Tinh giản style của `.saas-card` và `.saas-card-interactive`, tăng độ tương phản văn bản, chuẩn hóa nấc typography (xs, sm, base, lg, xl, 2xl).
2. Tinh chỉnh `src/components/Layout.tsx`:
   - Header: Giữ tên CLB và avatar/mascot nhỏ 36px, loại bỏ nhãn "Pro" thừa và slogan dài dòng.
   - Mobile Nav: Đảm bảo kích thước icon và label chuẩn tối thiểu 12px, cảm ứng ngón tay thoải mái.
   - Footer: Đưa về 1 dòng bản quyền gọn gàng, bỏ khẩu hiệu "SmashFlow Pro Edition Hệ sinh thái...".
3. Kiểm tra kiểm thử hồi quy cơ học: Chạy `npm test` để xác nhận Layout test không bị vỡ.

## Success Criteria
- [ ] Không còn class font chữ dưới 12px ở thanh điều hướng và shell layout.
- [ ] Header và footer tinh giản, hiện đại, không còn chữ quảng cáo AI.
- [ ] Giao diện cuộn mượt mà trên mobile, không bị giật do blur quá mức.

## Risk Assessment
- Rủi ro: Các test giao diện snapshot hoặc test tìm kiếm text ("SmashFlow Pro") trong `Layout.test.tsx` có thể fail.
- Giảm thiểu: Chạy `npm test` ngay sau khi sửa và cập nhật lại assertion tương ứng trong file test nếu cần.
