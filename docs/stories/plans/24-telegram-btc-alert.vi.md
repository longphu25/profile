# Story 24: Telegram BTC Chart Alert Mini App

**Trạng thái:** in-progress (Phase 0 xong, Phase 1–3 kế hoạch)  
**Phiên bản:** v0.115.0 (Mini App), v0.116.0 (auto-login)  
**Bản tiếng Anh:** [24-telegram-btc-alert.md](./24-telegram-btc-alert.md)

## Mục tiêu

Mini App Telegram hiển thị **ML bias** và **Trade Setup** từ engine btc-chart, **tự đăng
nhập Telegram** khi mở từ bot, **dùng chung Turso** (coins) và **Convex** (auth, cache,
alert tương lai).

## Vì sao

- Trader mobile ở Telegram; chart WASM đầy đủ quá nặng cho WebView.
- Trade Setup confluence là tín hiệu user đã quen trên chart desktop.
- Kênh bot là mặt alert tự nhiên, không cần app native.

## Quyết định đã chốt

1. **Entry Vite riêng** (`telegram-btc-alert.html`), không plugin Shadow DOM.
2. **Engine nhẹ:** Lux + ML + MA + Trade Setup; **không SMC WASM** v1.
3. **Poll 15s**; push alert để Phase 3.
4. **Auth:** hiện user ngay; Convex verify `initData` khi cấu hình.
5. **Phân tách dữ liệu:** Turso coin công khai; Convex secret/session/prefs.

Xem [decisions/telegram-data-backend.vi.md](../../decisions/telegram-data-backend.vi.md).

## Phase 0 — Đã ship ✅

### Hạng mục

| Hạng mục | Đường dẫn |
|----------|-----------|
| HTML entry | `telegram-btc-alert.html` |
| React app | `src/telegram-btc-alert/` |
| Bot | `apps/telegram/bot.mjs` |
| Convex auth | `apps/convex/convex/telegram/*` |
| Test | `tests/unit/telegram-*.test.ts` |
| Tài liệu | `docs/telegram/*` |

### Tiêu chí hoàn thành

- [x] Build và unit test pass
- [x] Mở từ Telegram thấy thanh user
- [ ] Push `origin/main` (cần SSH user)

## Phase 1 — Turso coin picker (kế hoạch)

[telegram/ROADMAP.vi.md](../../telegram/ROADMAP.vi.md) Phase 1.

## Phase 2 — Prefs user (kế hoạch)

Bảng `telegramPrefs`, API GET/PUT.

## Phase 3 — Push alert (kế hoạch)

Cron Convex + `sendMessage`, lưu `chat_id` khi `/start`.

## Phase 4+

Xem [telegram/ROADMAP.vi.md](../../telegram/ROADMAP.vi.md).

## Rủi ro

| Rủi ro | Giảm thiểu |
|--------|------------|
| Trade Setup khác chart (thiếu SMC) | Ghi rõ trên UI và TECHNICAL |
| Pages không có Convex | Session local vẫn chạy |
| Bot cần chạy liên tục | Doc VPS; webhook sau |

## Tham chiếu

- [docs/telegram/README.vi.md](../../telegram/README.vi.md)
- [docs/telegram/TECHNICAL.vi.md](../../telegram/TECHNICAL.vi.md)
- [docs/telegram/ROADMAP.vi.md](../../telegram/ROADMAP.vi.md)