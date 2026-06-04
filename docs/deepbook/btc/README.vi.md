# BTC Chart Pro — Tài Liệu

Tài liệu cho trang `btc-chart.html` và plugin `plugins/btc-chart/` trong dự án
profile.

Dữ liệu thị trường đến từ **Binance Spot REST + WebSocket** (miễn phí, không
cần API key). Chart engine là `lightweight-charts@4.2.0` được nạp qua CDN.
Toàn bộ UI render trong **Shadow DOM** theo plugin contract của profile.

---

## Mục Lục

| File | Nội dung |
|------|---------|
| [SESSION-CONTEXT.md](SESSION-CONTEXT.md) | **Bắt đầu từ đây** — trạng thái, file map, quyết định, bug, backlog |
| [overview.md](overview.md) | Tổng quan kiến trúc, file layout, render flow, data flow |
| [features.md](features.md) | 9 tính năng chính: chart, indicator, alert, sound, snapshot, persistence |
| [alerts.md](alerts.md) | Alert engine — 6 loại, logic đánh giá, âm thanh, browser notification |
| [storage.md](storage.md) | Schema config v1, throttling, import/export JSON, migration |
| [volume-profile.md](volume-profile.md) | VP renderer — bins, POC/VAH/VAL, HVN, heatmap |
| [order-flow-overlay.md](order-flow-overlay.md) | Order-flow pill overlay — gutter bands, leader lines, anti-collision |
| [snapshot.md](snapshot.md) | Xuất PNG — `takeScreenshot()` + ghép canvas |
| [styling.md](styling.md) | Design tokens, bảng màu, taste rules, layout discipline |

---

## Khởi Động Nhanh

```bash
# 1. Khởi động dev server của dự án
bun run dev

# 2. Mở trang
open http://localhost:5173/btc-chart.html
```

Nếu cổng 5173 đã được dùng, Vite sẽ tự chuyển sang 5174/5175. Xem log của
dev server.

---

## Cấu Trúc Nguồn

```text
btc-chart.html              # HTML entry — nạp lightweight-charts từ CDN
src/btc-chart/
  ├─ main.tsx               # React bootstrap
  ├─ BtcChartPage.tsx       # Wrapper page, mount plugin trong Shadow DOM
  └─ btc-chart.css          # Design tokens + page-level layout
plugins/btc-chart/
  ├─ plugin.tsx             # Plugin entry, React component chính
  ├─ style.css              # Scoped Shadow DOM styles (.btc-chart__*)
  ├─ storage.ts             # localStorage + JSON I/O
  ├─ alerts.ts              # Alert engine + Web Audio + Notification API
  ├─ volume-profile.ts      # Canvas VP renderer (heatmap + HVN)
  ├─ order-flow-overlay.ts  # Canvas OF pill overlay (gutter bands)
  └─ snapshot.ts            # Xuất PNG (ghép 3 pane + VP + OF overlays)
```

---

## Quan Hệ Với Plugin Host

| Chế độ | Hành vi |
|------|----------|
| Standalone (`btc-chart.html`) | `BtcChartPage` mount Shadow DOM và dùng `hostAPI` bình thường |
| Plugin demo (`plugin-demo.html`) | Chưa đăng ký; có thể thêm vào `AVAILABLE_PLUGINS` nếu cần |
| SUI Dashboard (`sui-plugin.html`) | Chưa đăng ký; plugin không cần ví nên shared mode khá đơn giản |

Plugin export component `BtcChart` qua `host.registerComponent('BtcChart', …)`
và không phụ thuộc DAppKit.

---

## Phụ Thuộc Bên Ngoài

| Package | Cách nạp | Lý do |
|---------|----------|------|
| `lightweight-charts@4.2.0` | CDN `<script>` trong `btc-chart.html` | Đã dùng trong `btc-chart-pro-v3.html` gốc; tránh tăng vendor chunk của Vite |
| Binance REST `api.binance.com` | `fetch` runtime | Klines + 24h ticker, không cần API key |
| Binance Futures REST `fapi.binance.com` | `fetch` runtime | Funding rate |
| Alternative.me `api.alternative.me/fng/` | `fetch` runtime | Chỉ số Fear & Greed |
| Binance WS `wss://stream.binance.com:9443` | `WebSocket` | Luồng kline live |

---

## Build / Xác Minh

```bash
# Production bundle
bun run build

# Lint
bun run lint
```

Plugin có entry riêng trong `vite.config.ts -> build.rollupOptions.input`:

```ts
'plugins/btc-chart': resolve(__dirname, 'plugins/btc-chart/plugin.tsx')
```

Đầu ra build: `dist/assets/plugins/btc-chart.js` (lazy-loaded khi trang mount).

---

## Liên Quan

- Plugin contract: [`docs/plugin-architecture.md`](../../plugin-architecture.md)
- Design system: [`DESIGN.md`](../../../DESIGN.md), Pro Max steering
- Chart tham chiếu gốc: `btc-chart-pro-v3.html` (HTML thuần, không bundle)
