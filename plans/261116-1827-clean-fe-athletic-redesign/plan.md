---
title: "Clean FE Athletic Redesign"
description: "Lược bỏ từ ngữ AI sáo rỗng, dẹp bỏ mascot chiếm chỗ, chuẩn hóa typography và dọn sạch layout toàn diện cho Badminton Hub theo phong cách thể thao hiện đại, trực diện."
status: pending
priority: P1
effort: "8h"
tags: ["frontend", "ui-ux", "redesign", "clean-code"]
created: 2026-11-16
---

# Clean FE Athletic Redesign (Tối Ưu & Tinh Gọn Giao Diện Cầu Lông)

## Overview
Giao diện hiện tại của Badminton Hub đang mắc phải các lỗi thiết kế phổ biến do AI tạo ra: nhiều khẩu hiệu sáo rỗng, mascot vịt khổng lồ choán chỗ, quá nhiều badge màu mè xếp chồng và chia cắt thông tin thành các hộp vụn vặt. Kế hoạch này giữ nguyên nền sân đặc trưng theo mong muốn của người dùng, nhưng đại tu layout, typography và copywriting trên toàn bộ các trang chính (Trang chủ, Chi tiết ca, Host Dashboard) để mang lại trải nghiệm thể thao sắc nét, thực tế và dễ thao tác.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Chuẩn hóa Design Tokens & Typography (loại bỏ chữ micro < 12px, giảm lag do backdrop blur) | P1 |
| 2 | Đại tu Trang chủ (SessionListView): bỏ Hero quảng cáo AI & vịt 180px, đưa ca sắp tới của user lên đầu, làm lại card ca gọn gàng | P1 |
| 3 | Tinh gọn Trang Chi tiết Ca & Host Dashboard: gom bảng giá 2 cột, tối ưu khoảng thở cho các nút thao tác ngoài sân | P1 |
| 4 | Đảm bảo 100% test suites hiện có vẫn chạy xanh (Exit Code 0) | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Chuẩn hóa Design Tokens, Typography & Layout Shell](./phase-01-start.md) | Pending |
| 2 | [Phase 2: Đại tu Trang chủ & Thẻ Ca Đánh](./phase-02-revamp-session-list.md) | Pending |
| 3 | [Phase 3: Tối ưu Trang Chi tiết Ca & Host Dashboard](./phase-03-refactor-session-detail-and-host-dashboard.md) | Pending |

## Success Criteria

- [ ] Lược bỏ 100% khẩu hiệu marketing sáo rỗng ("Pro Match System", "Hệ sinh thái thông minh", v.v.).
- [ ] Không còn con vịt Mascot 180px choán nửa màn hình trang chủ.
- [ ] Typography nhất quán, tối thiểu 12px, dễ đọc ngoài sân thể thao.
- [ ] Thẻ ca đấu hiển thị tức thì giờ, sân, số chỗ trống và giá vé trong vòng 2 giây.
- [ ] Host Dashboard thao tác thuận tiện, không bấm nhầm nút.
- [ ] Toàn bộ bộ test frontend `npm test` đều pass.

<!-- slug: clean-fe-athletic-redesign -->
