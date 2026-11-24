# Báo cáo Đánh giá Hiệu năng Frontend (Performance Investigation)
**Target:** https://badminton-hub-olive.vercel.app/  
**Thời gian kiểm tra:** 13/11/2026 (Live deployment on Vercel + Render backend)  
**Công cụ thực hiện:** Lighthouse v13.6 (Headless Chromium, Simulated Mobile/Desktop Throttling), Network Waterfall Trace, Node.js Asset Analysis, Codebase Static Audit.

---

## 1. Tổng quan Điểm số & Chỉ số Core Web Vitals

| Hạng mục | Mobile (Mô phỏng 4G / CPU Throttled) | Desktop | Ngưỡng chuẩn Google |
| :--- | :--- | :--- | :--- |
| **Performance Score** | **45 / 100 (KÉM)** | **81 / 100** | >= 90 (Tốt) |
| **FCP (First Contentful Paint)** | 1.3 s (Tốt) | 0.6 s (Tốt) | < 1.8 s |
| **LCP (Largest Contentful Paint)** | 1.3 s (Tốt) | 0.6 s (Tốt) | < 2.5 s |
| **TBT (Total Blocking Time)** | **5,490 ms (BÁO ĐỘNG ĐỎ)** | 20 ms (Tốt) | < 200 ms |
| **CLS (Cumulative Layout Shift)** | **0.433 (BÁO ĐỘNG ĐỎ)** | **0.256 (KÉM)** | < 0.1 |
| **Speed Index** | 5.9 s | 2.4 s | < 3.4 s |
| **TTI (Time to Interactive)** | 7.6 s | 0.7 s | < 3.8 s |
| **Accessibility** | 96 / 100 | 96 / 100 | >= 90 |
| **Best Practices** | 100 / 100 | 100 / 100 | >= 90 |
| **SEO** | 83 / 100 | 83 / 100 | >= 90 |

---

## 2. Danh sách Vấn đề Ưu tiên (Prioritized Findings)

### 🔴 MỨC ĐỘ 1: CRITICAL (Ảnh hưởng trực tiếp trải nghiệm & xếp hạng Google)

#### Issue 1: Giật khung hình nghiêm trọng (CLS = 0.433 trên Mobile, 0.256 trên Desktop)
- **Đo lường:** `Cumulative Layout Shift: 0.433` (Điểm Lighthouse: 0.22/1.0).
- **Phần tử gây ra:** `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">` (Đẩy layout xuống **5,083px**).
- **Vị trí code:** `frontend/src/views/SessionListView.tsx:465-502`
- **Nguyên nhân gốc rễ:**
  - Trong lúc API `/sessions` đang tải (`isLoading === true`), giao diện chỉ hiển thị 1 khối nhỏ cao ~150px:
    ```tsx
    <div className="text-center py-24 text-slate-600 text-sm animate-pulse space-y-3">
      <DuckMascot size={56} rounded="2xl" className="mx-auto" />
      <p className="font-bold text-slate-900">Đang tải dữ liệu ca đánh...</p>
    </div>
    ```
  - Khi dữ liệu 10+ ca đánh trả về từ Render backend (`~1.24s` sau), React thay thế khối 150px này bằng danh sách thẻ ca cao tới **5,083px**, làm toàn bộ nội dung bên dưới và footer bị dịch chuyển đột ngột.
- **Giải pháp khuyến nghị:**
  - Thay thế khối loader 150px bằng **Skeleton Cards** giữ đúng cấu trúc Grid:
    ```tsx
    {isLoading ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-72 rounded-3xl bg-slate-200/70 animate-pulse border border-slate-200" />
        ))}
      </div>
    ) : ...}
    ```
  - Đặt `min-height` cho container danh sách ca.
- **Kiểm chứng:** Chạy lại Lighthouse, CLS phải giảm từ `0.433` xuống `< 0.05`.

---

#### Issue 2: Main-thread bị nghẽn 9.0s trên Mobile (TBT = 5,490 ms)
- **Đo lường:** `Total Blocking Time: 5,490 ms`, `Main thread work: 9.0 s` (Style & Layout: 2,733ms, Script Eval: 2,341ms, Other: 3,743ms).
- **Vị trí code:**
  - `frontend/src/components/BadmintonCourtBg.tsx:10-18`
  - `frontend/src/index.css:28-57`
- **Nguyên nhân gốc rễ:**
  - Hiệu ứng đồ họa quá nặng cho GPU/CPU thiết bị di động:
    1. `BadmintonCourtBg.tsx` render 3 khối cầu Gaussian blur cực lớn (`w-[1200px] blur-[140px]`, `w-[600px] blur-[160px]`, `w-[700px] blur-[160px]`).
    2. Ảnh nền `badminton-bg-lol.jpg` (355KB) dùng bộ lọc CSS nặng: `mix-blend-multiply contrast-125 saturate-[0.9]`.
    3. Hàng chục thẻ `.saas-card` và `.saas-card-interactive` trên trang đồng thời áp dụng `backdrop-filter: blur(28px);` và đa tầng `box-shadow`.
  - Trên mobile CPU, việc tính toán 28px backdrop filter đè lên 160px blur background cho hơn 10 phần tử khiến GPU/CPU tốn hơn **2.7 giây** chỉ riêng cho bước Style & Layout, gây đơ lag khi cuộn trang hoặc chạm màn hình.
- **Giải pháp khuyến nghị:**
  - Tắt hoặc giảm `backdrop-filter` trên mobile:
    ```css
    @media (max-width: 768px) {
      .saas-card, .saas-card-interactive {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        background: #ffffff;
      }
    }
    ```
  - Trên `BadmintonCourtBg.tsx`, ẩn các khối blur 1200px trên mobile (`hidden md:block`), hoặc dùng gradient CSS tĩnh nhẹ hơn.
- **Kiểm chứng:** TBT mobile giảm từ `5,490ms` xuống `< 300ms`.

---

### 🟠 MỨC ĐỘ 2: HIGH (Tải trang lặp lại & Dung lượng gói JS)

#### Issue 3: Toàn bộ file tĩnh không được cache trình duyệt (`Cache-Control: max-age=0`)
- **Đo lường:** Headers trả về của `index-*.js`, `index-*.css`, `api-*.js`, `duck-mascot.png`:
  `Cache-Control: public, max-age=0, must-revalidate`
- **Vị trí code:** `frontend/vercel.json` và `vercel.json`
- **Nguyên nhân gốc rễ:**
  - File cấu hình Vercel hiện tại chỉ có:
    ```json
    {
      "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
    }
    ```
  - Không có cấu hình header caching cho thư mục `/assets/`. Mỗi lần người dùng vào lại app hoặc chuyển tab F5, trình duyệt phải gửi yêu cầu HTTP 304 revalidate cho gần **600KB** tài nguyên thay vì đọc ngay lập tức từ Memory/Disk cache (0ms).
- **Giải pháp khuyến nghị:**
  - Thêm cấu hình headers vào `frontend/vercel.json`:
    ```json
    {
      "headers": [
        {
          "source": "/assets/(.*)",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "public, max-age=31536000, immutable"
            }
          ]
        },
        {
          "source": "/(.*\\.(png|jpg|jpeg|gif|webp|svg|ico))",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "public, max-age=604800, stale-while-revalidate=86400"
            }
          ]
        }
      ],
      "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
    }
    ```
- **Kiểm chứng:** `curl -sI https://.../assets/index-*.js` phải trả về `Cache-Control: public, max-age=31536000, immutable`. Lần tải trang thứ 2 tốn 0ms cho assets.

---

#### Issue 4: Bundle chính ôm đồm code chưa cần thiết (Chưa Lazy Load triệt để)
- **Đo lường:** File `index-D-9YtWN0.js` nặng **394 KB** (117 KB compressed), Lighthouse báo lãng phí **49 KB** unused JS ngay màn hình đầu tiên.
- **Vị trí code:**
  - `frontend/src/App.tsx:8-10`:
    ```tsx
    import { SessionListView } from './views/SessionListView'
    import { SessionDetailView } from './views/SessionDetailView'
    import { LoginView } from './views/LoginView'
    ```
  - `frontend/src/components/Layout.tsx:20`:
    ```tsx
    import { ProfileModal } from './ProfileModal'
    ```
- **Nguyên nhân gốc rễ:**
  - `SessionDetailView.tsx` (1,409 dòng code), `LoginView.tsx` (549 dòng) và `ProfileModal.tsx` (340 dòng) được import tĩnh trực tiếp vào bundle chính.
  - Người dùng mới chỉ vào xem trang chủ đã phải tải và biên dịch trước toàn bộ logic thanh toán, modal nạp cọc, camera QR và form đổi mật khẩu.
- **Giải pháp khuyến nghị:**
  - Chuyển `SessionDetailView`, `LoginView`, `ProfileModal` sang `React.lazy()` tương tự như `HostDashboardView`:
    ```tsx
    const SessionDetailView = lazy(() => import('./views/SessionDetailView').then(m => ({ default: m.SessionDetailView })))
    const LoginView = lazy(() => import('./views/LoginView').then(m => ({ default: m.LoginView })))
    ```
  - Trong `vite.config.ts`, thêm `manualChunks` tách vendor (`react`, `react-dom`, `@tanstack/react-query`) để tận dụng cache lâu dài giữa các bản build.
- **Kiểm chứng:** Kích thước `index-*.js` ban đầu giảm xuống dưới **200 KB** uncompressed (~60 KB br).

---

### 🟡 MỨC ĐỘ 3: MEDIUM (Mạng & Tối ưu Media)

#### Issue 5: Độ trễ API Render và thiếu Preconnect Hint
- **Đo lường:** API `/api/sessions` mất **1,242 ms** TTFB. Trình duyệt không preconnect tới domain API.
- **Vị trí code:** `frontend/index.html`
- **Nguyên nhân gốc rễ:**
  - API backend đặt tại `https://smashflow-backend.onrender.com`.
  - Khi người dùng vào trang web, trình duyệt phải tải xong HTML -> tải JS -> chạy React -> gọi API thì mới bắt đầu phân giải DNS (DNS Lookup) và bắt tay bảo mật (TLS Handshake) tới server Render, tốn thêm 200-400ms không cần thiết.
- **Giải pháp khuyến nghị:**
  - Thêm thẻ preconnect vào `<head>` của `frontend/index.html`:
    ```html
    <link rel="preconnect" href="https://smashflow-backend.onrender.com" crossorigin />
    <link rel="dns-prefetch" href="https://smashflow-backend.onrender.com" />
    ```
- **Kiểm chứng:** Tab Network waterfall hiển thị kết nối TLS tới Render được thiết lập ngay từ đầu song song với việc tải file JS.

---

#### Issue 6: Ảnh nền 355KB dạng JPG chưa nén và Mascot lazy load sai vị trí
- **Đo lường:** `badminton-bg-lol.jpg` nặng **355 KB**. Lighthouse báo tiềm năng tiết kiệm 51 KB ảnh.
- **Vị trí code:**
  - `frontend/public/badminton-bg-lol.jpg`
  - `frontend/src/components/DuckMascot.tsx:45`
- **Nguyên nhân gốc rễ:**
  - Ảnh nền là file JPG thô độ phân giải lớn, chưa chuyển đổi sang định dạng WebP/AVIF.
  - `DuckMascot.tsx` hardcode thuộc tính `loading="lazy"`. Khi mascot nằm ở Header hoặc Hero banner (above-the-fold), thuộc tính này làm trình duyệt trì hoãn việc tải ảnh cho tới khi tính toán xong layout, gây chậm LCP hiển thị logo.
- **Giải pháp khuyến nghị:**
  - Convert `badminton-bg-lol.jpg` sang định dạng `.webp` (giảm dung lượng còn ~60-80 KB, tiết kiệm ~80%).
  - Bổ sung prop `priority?: boolean` cho `DuckMascot`: nếu `priority={true}` thì dùng `loading="eager"` và `fetchpriority="high"`.
- **Kiểm chứng:** Tiết kiệm ~280 KB dung lượng ảnh, LCP ảnh mascot tải tức thì.

---

### 🟢 MỨC ĐỘ 4: LOW (SEO & Cấu hình phụ trợ)

#### Issue 7: Thiếu file `robots.txt` và `meta description` (Điểm SEO: 83/100)
- **Đo lường:** Lighthouse SEO phát hiện:
  - `robots.txt is not valid [16 errors found]`: do Vercel rewrite toàn bộ đường dẫn `/robots.txt` về file `index.html`.
  - `Document does not have a meta description`.
- **Vị trí code:** `frontend/public/` và `frontend/index.html`
- **Giải pháp khuyến nghị:**
  - Tạo file `frontend/public/robots.txt`:
    ```text
    User-agent: *
    Allow: /
    ```
  - Bổ sung thẻ mô tả và theme-color trong `frontend/index.html`:
    ```html
    <meta name="description" content="Hệ thống quản lý ca đánh cầu lông, xếp sân và điểm danh thông minh - CLB Cầu Lông Làng Địa Ngục." />
    <meta name="theme-color" content="#090e17" />
    ```
- **Kiểm chứng:** Lighthouse SEO đạt **100 / 100**.

---

## 3. Lộ trình Triển khai (Action Plan)

| Giai đoạn | Hành động cụ thể | File tác động | Dự kiến tác động |
| :--- | :--- | :--- | :--- |
| **Bước 1 (15m)** | Thêm Skeleton Card thay thế loading pulse nhỏ để triệt tiêu CLS | `frontend/src/views/SessionListView.tsx` | CLS giảm từ 0.433 về < 0.05 |
| **Bước 2 (15m)** | Tắt backdrop-filter và thu nhỏ blur 1200px trên Mobile | `frontend/src/index.css`, `BadmintonCourtBg.tsx` | TBT mobile giảm từ 5.4s về < 500ms |
| **Bước 3 (10m)** | Cấu hình Cache-Control 1 năm immutable cho file tĩnh trên Vercel | `frontend/vercel.json` | Lần vào sau tải trang 0ms |
| **Bước 4 (20m)** | Lazy load `SessionDetailView`, `LoginView`, `ProfileModal` | `frontend/src/App.tsx`, `Layout.tsx` | Giảm 100KB bundle khởi động |
| **Bước 5 (10m)** | Thêm Preconnect API Render & meta SEO + robots.txt | `frontend/index.html`, `public/robots.txt` | API kết nối sớm hơn 300ms, SEO 100/100 |
| **Bước 6 (15m)** | Nén ảnh nền WebP và tối ưu priority cho Mascot | `public/`, `DuckMascot.tsx` | Tiết kiệm 280KB network |

---
*Báo cáo được khởi tạo tự động bởi Frontend Performance Investigator.*
