# ADR: Backend dữ liệu Telegram Mini App (Turso + Convex)

**Trạng thái:** Chấp nhận (tháng 7/2026)  
**Ngữ cảnh:** Telegram BTC Chart Alert, dùng chung với plugin btc-chart  
**Bản tiếng Anh:** [telegram-data-backend.md](./telegram-data-backend.md)

## Vấn đề

Mini App chạy trên **GitHub Pages** (tĩnh). Auto-login Telegram cần verify `initData`
bằng bot token. Dữ liệu theo user (prefs, đăng ký alert) không được ghi từ read token
Turso nhúng trong bundle client.

Repo đã có:

- **Turso:** bảng `coins` cho btc-chart
- **Convex:** `marketSnapshots`, HTTP Actions, cron

Có thể dùng **cả hai** cho Telegram không?

## Quyết định

**Có. Dùng chung với phân tách rõ:**

| Loại dữ liệu | Lưu ở đâu | Cách truy cập |
|--------------|-----------|---------------|
| Catalog coin công khai | Turso `coins` | Client đọc `fetchCoinsFromTurso` |
| Bot token, session | Chỉ Convex env | Không vào client |
| Profile + session Telegram | Bảng Convex | HTTP sau HMAC |
| Prefs, trạng thái alert | Convex (Phase 2) | Bearer token |
| Mirror prefs (tùy chọn) | Turso qua action Convex | `TURSO_ADMIN_TOKEN` server |
| Cache market | Convex `marketSnapshots` | HTTP GET, chung chart |

**Không** lưu session hoặc bot token trong Turso mà Mini App đọc được.

## Lý do

### Turso cho coins

- Đã có seed và CLI `turso-coins.mjs`
- Cùng routing symbol với chart
- Read token thiết kế cho dữ liệu công khai

### Convex cho auth và prefs

- Bot token phải ở server để HMAC
- Đã có pattern HTTP Actions
- Cron phù hợp push alert
- Schema + index theo `telegramId`

### Không Turso-only

- Trang tĩnh không verify `initData` an toàn nếu lộ bot token
- Read token không cấp session ghi cho user

### Không Convex-only cho coins

- Trùng workflow Turso hiện có
- Admin coin đang dùng CLI, không phải Convex dashboard

## Hệ quả

**Tích cực:** Một nguồn coin, một Convex cho auth/cache/alert, ranh giới bảo mật rõ.

**Tiêu cực:** Nhiều biến môi trường hơn khi deploy đủ tính năng.

**Trung tính:** Mini App vẫn chạy không Turso/Convex (symbol cứng, session local).

## Ghi chú triển khai

1. Frontend: chỉ `VITE_*`.
2. Convex: `TELEGRAM_BOT_TOKEN`, `CLIENT_ORIGIN` có GitHub Pages.
3. Bot: `TELEGRAM_WEBAPP_URL`.
4. Turso admin: không `VITE_*`.

## Tham chiếu

- [docs/telegram/TECHNICAL.vi.md](../telegram/TECHNICAL.vi.md)
- [docs/telegram/ROADMAP.vi.md](../telegram/ROADMAP.vi.md)