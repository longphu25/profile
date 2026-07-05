# Runtime Entry Points

## Tổng quan

Repo dùng Vite multi-entry. Một project nhưng có nhiều trang độc lập, mỗi trang phục vụ một lớp use case khác nhau.

## Index Portfolio

- HTML: `index.html`
- React entry: `src/main.tsx`
- Root component: `src/Portfolio.tsx`
- Mục đích: portfolio/landing page cá nhân

Đây là mặt tiền public của repo, không phải dashboard plugin.

## App Placeholder

- HTML: `app.html`
- React entry: `src/app/main.tsx`
- Mục đích: placeholder page rất mỏng

Trang này hiện chưa mang business value lớn. Có thể xem như slot dự phòng hoặc sandbox.

## Generic Plugin Demo

- HTML: `plugin-demo.html`
- React entry: `src/plugin-demo/main.tsx`
- Root component: `src/plugin-demo/PluginDemoApp.tsx`
- Runtime: `src/plugins/*`

Use case:

- thử cơ chế load/unload plugin
- kiểm tra `HostAPI`
- render plugin trong `ShadowContainer`
- test plugin không phụ thuộc shared Sui context

## Shared Sui Dashboard

- HTML: `sui-plugin.html`
- React entry: `src/sui-dashboard/main.tsx`
- Root component: `src/sui-dashboard/SuiDashboard.tsx`
- Runtime: `src/sui-dashboard/*`

Use case:

- kết nối ví qua `@mysten/dapp-kit-react`
- chia sẻ account/network state cho nhiều plugin
- cho phép plugin yêu cầu connect/disconnect/network switch
- cho phép plugin ký và submit transaction qua host

Đây là runtime quan trọng nhất nếu nhìn repo như một Sui app platform.

## WASM Dashboard

- HTML: `sui-plugin-wasm.html`
- React entry: `src/sui-wasm/main.tsx`
- Root component: `src/sui-wasm/SuiWasmDashboard.tsx`
- Runtime đặc thù: `src/sui-wasm/wasm-loader.ts`

Use case:

- load plugin có liên quan WASM hoặc WASM-grade crypto
- hiển thị metadata/detection về WASM usage
- thử các plugin nặng hơn như wallet creation hoặc analysis

## DeepBook Hedging Bot Page

- HTML: `sui-deepbook-hedging-bot.html`
- React entry: `src/sui-deepbook-hedging-bot/main.tsx`
- Mục đích: page chuyên biệt cho hedging bot

Trang này tách riêng vì feature bot lớn hơn mức "một card plugin thông thường".

## Telegram BTC Chart Alert (Mini App)

- HTML: `telegram-btc-alert.html`
- React entry: `src/telegram-btc-alert/main.tsx`
- Root component: `src/telegram-btc-alert/App.tsx`
- Mục đích: ML bias + Trade Setup alert trong Telegram WebApp, auto-login Telegram

Use case:

- mở từ bot Telegram (`bun run telegram:bot`) hoặc menu **Chart Alert**
- poll klines 15s, engine nhẹ (Lux + ML + Trade Setup, không SMC WASM)
- auth tùy chọn qua Convex `POST /telegram/auth`

Tài liệu: `docs/telegram/README.vi.md`, `docs/telegram/TECHNICAL.vi.md`.

## Registration nằm ở đâu

Muốn một plugin thật sự hoạt động đầy đủ, thường phải chạm ít nhất 3 điểm:

1. `plugins/<name>/plugin.tsx`
2. dashboard registry phù hợp:
   - `src/plugin-demo/PluginDemoApp.tsx`
   - hoặc `src/sui-dashboard/SuiDashboard.tsx`
   - hoặc `src/sui-wasm/SuiWasmDashboard.tsx`
3. `vite.config.ts` để build plugin thành entry riêng

## Dev path vs production path

Hầu hết dashboard dùng pattern:

- dev: load trực tiếp `plugins/<name>/plugin.tsx`
- production: load `assets/plugins/<name>.js`

Điểm này được thể hiện qua helper `pluginPath(...)` ở từng dashboard.

## Build mechanics cần nhớ

`vite.config.ts` đang làm 2 việc quan trọng ngoài build thông thường:

1. Khai báo nhiều entry HTML/plugin trong `rollupOptions.input`
2. Copy `style.css` và WASM package từ `plugins/*` sang `dist/plugins/*`

Không có bước này, Shadow DOM `<link rel="stylesheet">` của plugin sẽ hỏng ở production.
