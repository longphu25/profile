# BTC Chart Pro — Tài liệu

Tài liệu cho trang `btc-chart.html` + plugin `plugins/btc-chart/` trong dự án profile.

Dữ liệu thị trường lấy từ **Binance Spot REST + WebSocket** (free, không cần API key). Chart engine là `lightweight-charts@4.2.0` qua CDN. Toàn bộ UI render trong **Shadow DOM** theo plugin contract của profile.

---

## Mục lục

| File | Nội dung |
|------|---------|
| [SESSION-CONTEXT.md](SESSION-CONTEXT.md) | **Start here** — trạng thái, file map, decisions, bugs, backlog |
| [overview.md](overview.md) | Tổng quan kiến trúc, file layout, render flow, data flow |
| [features.md](features.md) | 9 tính năng chính: chart, indicators, alerts, sound, snapshot, persist… |
| [alerts.md](alerts.md) | Alert engine — 6 loại, evaluation logic, sound, browser notification |
| [storage.md](storage.md) | Schema config v1, throttle, import/export JSON, migration |
| [volume-profile.md](volume-profile.md) | VP renderer — bins, POC/VAH/VAL, HVN, heatmap |
| [order-flow-overlay.md](order-flow-overlay.md) | OF pills overlay — gutter bands, leader lines, anti-collision |
| [snapshot.md](snapshot.md) | PNG export — `takeScreenshot()` + canvas compose |
| [styling.md](styling.md) | Design tokens, color palette, taste rules, layout discipline |

---

## Quick start

```bash
# 1. Khởi động dev server (project gốc)
bun run dev

# 2. Mở trang
open http://localhost:5173/btc-chart.html
```

Nếu cổng 5173 đã dùng, Vite sẽ tự nhảy sang 5174/5175. Xem log dev server.

---

## Cấu trúc nguồn

```
btc-chart.html              ← Entry HTML, load lightweight-charts CDN
src/btc-chart/
  ├─ main.tsx               ← React bootstrap
  ├─ BtcChartPage.tsx       ← Wrapper page, mount plugin trong Shadow DOM
  └─ btc-chart.css          ← Design tokens + page-level layout
plugins/btc-chart/
  ├─ plugin.tsx             ← Plugin entry, React component chính
  ├─ style.css              ← Scoped Shadow DOM styles (.btc-chart__*)
  ├─ storage.ts             ← localStorage + JSON I/O
  ├─ alerts.ts              ← Alert engine + Web Audio + Notification API
  ├─ volume-profile.ts      ← Canvas VP drawer (heatmap + HVN)
  ├─ order-flow-overlay.ts  ← Canvas OF pills overlay (gutter bands)
  └─ snapshot.ts            ← PNG export (compose 3 panes + VP + OF overlay)
```

---

## Quan hệ với plugin host

| Mode | Behavior |
|------|----------|
| Standalone (`btc-chart.html`) | `BtcChartPage` mount Shadow DOM, dùng `hostAPI` thường |
| Plugin demo (`plugin-demo.html`) | Chưa register, có thể thêm vào `AVAILABLE_PLUGINS` nếu cần |
| SUI Dashboard (`sui-plugin.html`) | Chưa register; plugin không cần wallet nên Shared mode đơn giản |

Plugin export `BtcChart` component qua `host.registerComponent('BtcChart', …)` và không phụ thuộc DAppKit.

---

## Phụ thuộc ngoài

| Package | Cách load | Lý do |
|---------|----------|------|
| `lightweight-charts@4.2.0` | CDN `<script>` trong `btc-chart.html` | Đã dùng trong file gốc `btc-chart-pro-v3.html`, không cần đưa vào bundle Vite (vendor chunk nhẹ hơn) |
| Binance REST `api.binance.com` | `fetch` runtime | Klines + 24h ticker, no key |
| Binance Futures REST `fapi.binance.com` | `fetch` runtime | Funding rate |
| Alternative.me `api.alternative.me/fng/` | `fetch` runtime | Fear & Greed |
| Binance WS `wss://stream.binance.com:9443` | `WebSocket` | Live kline stream |

---

## Build / Verify

```bash
# Frontend bundle (production)
bun run build

# Lint
bun run lint
```

Plugin có entry riêng trong `vite.config.ts → build.rollupOptions.input`:

```ts
'plugins/btc-chart': resolve(__dirname, 'plugins/btc-chart/plugin.tsx')
```

Build output: `dist/assets/plugins/btc-chart.js` (lazy-loaded khi page mount).

---

## Liên quan

- Plugin contract: [`docs/plugin-architecture.md`](../../plugin-architecture.md)
- Design system: [`DESIGN.md`](../../../DESIGN.md), Pro Max steering
- Chart gốc tham khảo: `btc-chart-pro-v3.html` (HTML thuần, không bundle)
