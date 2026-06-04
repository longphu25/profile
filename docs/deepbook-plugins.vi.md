# Lộ Trình Plugin DeepBook

Các plugin được phát triển từ logic [depbuk-hedging](../../airdrop/depbuk-hedging),
được điều chỉnh cho kiến trúc plugin React + Vite trong dự án này.

Các module nguồn tham chiếu nằm dưới `depbuk-hedging/src/lib/server/bot/`.

---

## Tổng Quan Trạng Thái

| # | Plugin | Trạng thái | Commit |
|---|--------|--------|--------|
| 1 | `sui-pool-explorer` | ✅ Done | `6133100` |
| 2 | `sui-price-feed` | ✅ Done | `2c90905` |
| 3 | `sui-deepbook-portfolio` | ✅ Done | `4aee8f2` |
| 4 | `sui-deepbook-history` | ✅ Done | `03e357b` |
| 5 | `sui-swap` | ✅ Done | `7483cf1` |
| 6 | `sui-deepbook-orderbook` | ✅ Done | `ff6c840` |
| 7 | `sui-hedging-monitor` | ✅ Done | `2ecc9a9` |
| 8 | `sui-margin-manager` | ✅ Done | `a1b97f9` |

Host API: `signAndExecuteTransaction` được thêm trong `0ea4c8f`
Deps + vite config: `6b2e0fd` (v0.20.0)
WASM dashboard registration: `5c736cd`

---

## ✅ Các Plugin Đã Hoàn Thành

### 1. `sui-pool-explorer` — Trình Duyệt Pool DeepBook

**Ưu tiên:** 🥉 | **Công sức:** Thấp | **Trạng thái:** ✅ Done

Duyệt toàn bộ pool DeepBook v3 với dữ liệu live từ public indexer.

- Fetch `/get_pools`, `/summary`, `/ticker` song song
- Bảng có thể sắp xếp: giá, thay đổi 24h, volume, spread
- Panel chi tiết mở rộng bằng click với tick/lot/min size
- Mini orderbook (top 5 bids + asks) theo yêu cầu
- Chuyển network (mainnet/testnet), bộ lọc tìm kiếm
- Badge trạng thái Active/Frozen

**Nguồn dữ liệu:** DeepBook Indexer REST API (không cần SDK)

---

### 2. `sui-price-feed` — Bảng Giá Theo Thời Gian Thực

**Ưu tiên:** 🥈 | **Công sức:** Thấp | **Trạng thái:** ✅ Done

Giá token live kèm biểu đồ sparkline OHLCV.

- Lưới price card (top 12 cặp theo volume)
- Biểu đồ ASCII sparkline từ endpoint `/ohclv`
- Bộ chọn khoảng thời gian: 1h, 4h, 1d, 1w
- Tự làm mới mỗi 30s
- Thống kê High/Low/Volume theo khoảng nến

**Nguồn dữ liệu:** DeepBook Indexer `/summary`, `/ohclv/:pool`

---

### 3. `sui-deepbook-portfolio` — Trình Xem Vị Thế DeepBook

**Ưu tiên:** 🥈 | **Công sức:** Trung bình | **Trạng thái:** ✅ Done

Xem margin position, collateral, LP và DeepBook points cho bất kỳ ví nào.

- Nhập địa chỉ ví hoặc tự đồng bộ từ ví đã kết nối
- Card tổng quan: Total Equity, Total Debt, Net Value
- Bảng: Margin Positions (có risk ratio), Collateral Balances, LP Positions
- Badge DeepBook Points (⚡ pts)

**Nguồn dữ liệu:** DeepBook Indexer `/portfolio/:address`, `/get_points`

---

### 4. `sui-deepbook-history` — Trình Duyệt Lịch Sử Giao Dịch

**Ưu tiên:** 🥉 | **Công sức:** Trung bình | **Trạng thái:** ✅ Done

Duyệt các giao dịch gần đây trên DeepBook v3 theo từng pool.

- Dropdown chọn pool từ `/get_pools`
- Bộ lọc balance manager ID tùy chọn
- Thống kê: số giao dịch, volume base/quote, tổng phí
- Bảng: thời gian, phía giao dịch (badge BUY/SELL), giá, khối lượng, breakdown phí, link tx sang Suiscan

**Nguồn dữ liệu:** DeepBook Indexer `/trades/:pool`, `/get_pools`

---

### 5. `sui-swap` — Widget Hoán Đổi Token

**Ưu tiên:** 🥇 | **Công sức:** Trung bình | **Trạng thái:** ✅ Done

Hoán đổi token qua DeepBook v3 bằng ký giao dịch on-chain thực.

- Ước tính output dựa trên orderbook (mô phỏng market order)
- Dựng giao dịch swap qua SDK `@mysten/deepbook-v3`
  - `swapExactQuoteForBase` (buy) / `swapExactBaseForQuote` (sell)
- Ký qua `SuiHostAPI.signAndExecuteTransaction`
- Bộ chọn slippage (0.1%, 0.5%, 1.0%), hiển thị min received
- Cảnh báo price impact, trạng thái thành công với link tx Suiscan
- Kiểm tra tương thích pool với SDK cho các pool chưa được hỗ trợ
- Mini orderbook (top 5 bids + asks)

**Nguồn dữ liệu:** DeepBook Indexer `/get_pools`, `/ticker`, `/orderbook/:pool` + SDK `@mysten/deepbook-v3`

---

## ✅ Các Plugin Hoàn Thành Bổ Sung

### 6. `sui-deepbook-orderbook` — Widget Orderbook Trực Tiếp

**Ưu tiên:** 🥇 | **Công sức:** Trung bình | **Trạng thái:** ✅ Done

Hiển thị orderbook level 2 live với đầy đủ tính năng.

- Bộ chọn pool cho toàn bộ pool hiện có
- Bộ chọn độ sâu: 10, 20, 50 level
- Tự làm mới: 3s, 5s, 10s hoặc thủ công (kèm live pulse indicator)
- Banner mid-price với spread tuyệt đối + phần trăm
- Biểu đồ cumulative depth (thanh volume bid/ask)
- Sổ lệnh Level 2: giá, kích thước, tổng lũy kế với thanh nền volume

**Nguồn dữ liệu:** DeepBook Indexer `/orderbook/:pool`, `/get_pools`

---

### 7. `sui-hedging-monitor` — Bảng Điều Khiển Trạng Thái Bot

**Ưu tiên:** 4 | **Công sức:** Thấp | **Trạng thái:** ✅ Done

Kết nối tới một instance depbuk-hedging bot đang chạy qua REST/SSE API.

- Ô nhập URL kèm Connect/Disconnect
- Thanh trạng thái live với lifecycle dot (RUNNING/STOPPED/ERROR/BOOTING)
- Nút Start và Stop & Clean qua `/api/bot/control`
- Thống kê: giá SUI, session PnL, volume hôm nay/toàn thời gian, phí, cycles
- Card chu kỳ đang chạy: stage, giá, notional, progress bar giữ lệnh
- Runtime log (20 dòng gần nhất, tô màu theo level)
- SSE stream cho cập nhật snapshot thời gian thực

**Nguồn dữ liệu:** Bot REST API `/api/bot/status`, `/api/bot/stream` (SSE), `/api/bot/control`

---

### 8. `sui-margin-manager` — Trình Xem Tài Khoản Margin

**Ưu tiên:** 4 | **Công sức:** Trung bình | **Trạng thái:** ✅ Done

Kiểm tra DeepBook margin manager với dữ liệu balance và order chi tiết.

- Nhập địa chỉ ví và tự đồng bộ từ ví đã kết nối
- Card theo từng manager: pool, badge risk ratio (Safe/Caution/At Risk)
- Lưới số dư: base/quote assets + debts với giá trị USD
- Thanh tỷ lệ debt/equity có mã màu
- Bảng open orders theo từng manager (side, price, qty, filled, remaining)
- Tính toán net value

**Nguồn dữ liệu:** DeepBook Indexer `/portfolio/:address`, `/orders/:pool/:balance_manager`

---

## Ghi Chú Triển Khai

- Cả 8 plugin đều theo interface `Plugin` / `SuiHostAPI` hiện có trong `src/plugins/types.ts`
- Mỗi plugin nằm trong `plugins/<name>/` với `plugin.tsx` + `style.css`
- Hỗ trợ hai chế độ: standalone (`plugin-demo`) hoặc shared context (`sui-dashboard`)
- Đọc on-chain dùng `@mysten/sui` v2 (`SuiGrpcClient`) — đã là dependency của dự án
- `@mysten/deepbook-v3` đã được thêm làm dependency (dùng cho `sui-swap`)
- Cả 8 plugin đều đã được đăng ký trong `SuiWasmDashboard` (ESM badge)
- `SuiHostAPI.signAndExecuteTransaction` đã được thêm cho các giao dịch do ví ký
