# Telegram BTC Chart Alert — Lộ trình

**Trạng thái:** Đang active (sau v0.116.0)  
**Bản tiếng Anh:** [ROADMAP.md](./ROADMAP.md)  
**Story:** [stories/plans/24-telegram-btc-alert.vi.md](../stories/plans/24-telegram-btc-alert.vi.md)

## Mục tiêu

Biến Mini App thành mặt alert production, **dùng chung Turso** (catalog) và **Convex**
(auth, cache, cron) với plugin btc-chart, không lộ secret trong bundle tĩnh.

## Tóm tắt phase

| Phase | Chủ đề | Ưu tiên | Phụ thuộc |
|-------|--------|---------|-----------|
| 0 | Mini App + auto-login | **Xong** | v0.115.0–v0.116.0 |
| 1 | Chọn coin từ Turso | Cao | `VITE_TURSO_*` trên Pages |
| 2 | Prefs user (symbol, interval, alert) | Cao | Convex + auth |
| 3 | Push khi bias/plan đổi | Trung bình | Bot + cron Convex |
| 4 | Cache market dùng chung | Trung bình | `marketSnapshots` |
| 5 | Parity SMC (tùy chọn) | Thấp | Budget WASM WebView |
| 6 | Watchlist, admin | Stretch | Bảng Convex mới |

---

## Phase 0 — Đã ship

- [x] Entry Vite, engine Lux + ML + Trade Setup
- [x] Poll 15s, haptic
- [x] Auto-login + Convex auth
- [x] Bot `bot.mjs`
- [x] Tài liệu `docs/telegram/`

---

## Phase 1 — Turso coin picker

**Vấn đề:** User gõ symbol tay; chart đã đọc bảng `coins` từ Turso.

**Việc cần làm:**

1. Gọi `fetchCoinsFromTurso` (cùng client với chart).
2. Dropdown/search thay input text.
3. Fallback list cứng khi chưa cấu hình Turso.

**Env:** `VITE_TURSO_DB_URL`, `VITE_TURSO_DB_READ_TOKEN` (đã có trong `.env.example`).

**Ước lượng:** 0.5–1 ngày.

---

## Phase 2 — User preferences (Convex)

**Vấn đề:** Mỗi lần mở lại mất symbol/interval (trừ `start_param`).

**Schema:** `telegramPrefs` (symbol mặc định, interval, bật alert).

**API:** `GET/PUT /telegram/prefs` với Bearer session.

**Client:** Sau auth, load prefs vào `useBtcAlert`.

**Ước lượng:** 1–2 ngày.

---

## Phase 3 — Push alert

**Vấn đề:** User phải mở Mini App mới thấy bias đổi.

**Luồng:** Convex cron → so sánh `biasKey` → `sendMessage` qua Bot API.

**Cần:** Lưu `chat_id` khi user `/start`, rate limit 1 msg / 15 phút / symbol.

**Ước lượng:** 2–3 ngày.

---

## Phase 4 — Market cache chung

Wire `GET /btc-chart/market` vào UI Mini App (funding/OI tùy chọn).
Theo [decisions/btc-chart-exchange-backend.vi.md](../decisions/btc-chart-exchange-backend.vi.md).

---

## Phase 5 — SMC parity (tùy chọn)

| Phương án | Ghi chú |
|-----------|---------|
| WASM trên client | Parity đủ, nặng WebView |
| SMC trên Convex | Client mỏng, tốn compute |
| Chỉ document gap | Đang dùng |

**Khuyến nghị:** Giữ gap cho đến khi Phase 3 chứng minh nhu cầu.

---

## Phase 6 — Stretch

Watchlist, kênh broadcast, liên kết ví Sui, rate limit theo user.

---

## Thứ tự đề xuất

1. Phase 1 Turso (UX nhanh, không schema mới)
2. Phase 2 prefs (cần Convex production)
3. Phase 3 push (khác biệt sản phẩm Telegram)
4. Phase 4 market (khi backend OI chart sẵn sàng)
5. Phase 5 SMC (nếu user phàn nàn độ chính xác alert)

## Câu hỏi mở

1. Host bot trên VPS hay webhook serverless?
2. Một bot token hay tách dev/prod?
3. Copy alert tiếng Việt hay song ngữ?

Ghi quyết định vào [decisions/telegram-data-backend.vi.md](../decisions/telegram-data-backend.vi.md) khi chốt.