# Telegram BTC Chart Alert

Tài liệu cho Telegram Mini App hiển thị **ML bias** và **Trade Setup** từ plugin
btc-chart, kèm **đăng nhập tự động Telegram**.

## Tài liệu

| File | Mô tả |
|------|--------|
| [DEPLOY.vi.md](./DEPLOY.vi.md) | **Hướng dẫn triển khai:** Pages + BotFather + chạy `bot.mjs` 24/7 |
| [TECHNICAL.vi.md](./TECHNICAL.vi.md) | Kiến trúc, luồng auth, vai trò Turso/Convex, cấu trúc file, biến môi trường |
| [ROADMAP.vi.md](./ROADMAP.vi.md) | Lộ trình: Turso coins, prefs user, push alert, parity SMC |
| [../decisions/telegram-data-backend.vi.md](../decisions/telegram-data-backend.vi.md) | ADR: Turso vs Convex cho dữ liệu Telegram |
| [../stories/plans/24-telegram-btc-alert.vi.md](../stories/plans/24-telegram-btc-alert.vi.md) | Story plan và phạm vi đã ship (v0.115.0–v0.116.0) |

## Vận hành nhanh

Xem thêm `apps/telegram/README.md` ở root repo: BotFather, lệnh `bun run telegram:bot`.

## URL

| Môi trường | URL |
|------------|-----|
| Production (GitHub Pages) | `https://longphu25.github.io/profile/telegram-btc-alert.html` |
| Dev local | `http://localhost:5173/telegram-btc-alert.html` |
| Chart đầy đủ | `{origin}{base}/btc-chart.html` |

## Đã ship (v0.115.0–v0.116.0)

- Entry Vite `telegram-btc-alert.html` + `src/telegram-btc-alert/`
- Poll 15s: Lux NWE + ML + MA gate + Trade Setup (không SMC WASM)
- Theme Telegram WebApp, haptic khi bias/plan đổi
- Auto-login: thanh user từ `initData` + tùy chọn Convex `/telegram/auth`
- Bot long-polling: `/start`, `/chart`, menu **Chart Alert**
- Bảng Convex: `telegramUsers`, `telegramSessions`

## Tài liệu btc-chart liên quan

- [btc-chart/README.vi.md](../btc-chart/README.vi.md)
- [btc-chart/trade-setup.vi.md](../btc-chart/trade-setup.vi.md)
- [btc-chart/ml-signal.vi.md](../btc-chart/ml-signal.vi.md)
- [decisions/btc-chart-exchange-backend.vi.md](../decisions/btc-chart-exchange-backend.vi.md)