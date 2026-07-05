# Story 24: Telegram BTC Chart Alert Mini App

**Status:** in-progress (Phase 0 done, Phases 1–3 planned)  
**Versions:** v0.115.0 (Mini App), v0.116.0 (auto-login)  
**Companion:** [24-telegram-btc-alert.vi.md](./24-telegram-btc-alert.vi.md)

## Goal

Deliver a Telegram Mini App that shows **ML bias** and **Trade Setup plan** from the
btc-chart engine, with **automatic Telegram login** when opened from the bot, sharing
**Turso** (coins) and **Convex** (auth, cache, future alerts) with the rest of the repo.

## Why

- Mobile traders live in Telegram; full chart WASM is too heavy for WebView.
- Trade Setup confluence is the same signal users watch on desktop chart.
- Bot channel is a natural alert surface without building a native app.

## Locked decisions

1. **Standalone Vite entry**, not a Shadow DOM plugin (`telegram-btc-alert.html`).
2. **Lightweight engine:** Lux + ML + MA gate + Trade Setup; **no SMC WASM** in v1.
3. **Poll 15s** in Mini App; push alerts deferred to Phase 3.
4. **Auth:** client shows Telegram user immediately; Convex verifies `initData` when configured.
5. **Data split:** Turso for public coins; Convex for secrets, sessions, prefs (ADR accepted).

See [decisions/telegram-data-backend.md](../../decisions/telegram-data-backend.md).

## Phase 0 — Shipped ✅

### Deliverables

| Item | Path |
|------|------|
| HTML entry | `telegram-btc-alert.html` |
| React app | `src/telegram-btc-alert/` |
| Bot | `apps/telegram/bot.mjs`, `bun run telegram:bot` |
| Convex auth | `apps/convex/convex/telegram/*`, `/telegram/auth` |
| Tests | `tests/unit/telegram-*.test.ts` |
| Ops README | `apps/telegram/README.md` |

### Commits (reference)

- `feat(telegram): add BTC Chart alert mini app` (v0.115.0)
- `feat(telegram): auto-login with Telegram account in mini app` (v0.116.0)

### Exit criteria

- [x] `bun run build` passes
- [x] Unit tests for initData HMAC and user parse
- [x] Manual: open from Telegram shows user bar
- [ ] Push to `origin/main` (blocked on SSH auth in agent env)

## Phase 1 — Turso coin picker (planned)

**Status:** planned  
**Doc:** [telegram/ROADMAP.md](../../telegram/ROADMAP.md) Phase 1

- Wire `fetchCoinsFromTurso` into symbol selector
- Reuse `VITE_TURSO_DB_URL` / `VITE_TURSO_DB_READ_TOKEN`

## Phase 2 — User prefs (planned)

**Status:** planned

- Convex `telegramPrefs` table
- `GET/PUT /telegram/prefs`
- Default symbol, interval, alerts toggle

## Phase 3 — Push alerts (planned)

**Status:** planned

- Store `chat_id` on `/start`
- Convex cron + `sendMessage` on bias/plan edge
- Rate limits per user/symbol

## Phase 4+ — See ROADMAP

Market cache, SMC parity, watchlists: [telegram/ROADMAP.md](../../telegram/ROADMAP.md).

## File touch map (Phase 0)

```
telegram-btc-alert.html
src/telegram-btc-alert/**
apps/telegram/**
apps/convex/convex/schema.ts
apps/convex/convex/http.ts
apps/convex/convex/telegram/**
vite.config.ts
tsconfig.app.json
package.json
.env.example
apps/convex/.env.example
tests/unit/telegram-*.test.ts
docs/telegram/**
docs/decisions/telegram-data-backend.md
```

## Validation matrix

| Work type | Checks |
|-----------|--------|
| Frontend change | `bun run build`, eslint staged |
| Auth / Convex | `bun run convex:typecheck`, `telegram-init-data.test.ts` |
| Bot | Manual `/start` + menu button |
| Docs | Bilingual pair `.md` + `.vi.md`, update INDEX |

## Dependencies

- `@btc-chart/*` alias to `plugins/btc-chart/lib`
- Telegram WebApp script (`telegram.org/js/telegram-web-app.js`)
- Optional: Convex deployment with `TELEGRAM_BOT_TOKEN`

## Risks

| Risk | Mitigation |
|------|------------|
| Trade Setup differs from full chart (no SMC) | Document in UI + TECHNICAL.md |
| GitHub Pages without Convex URL | Local session still works |
| Bot must run 24/7 for menu + `/start` | Document VPS/tmux; webhook later |
| `initData` expires (24h server rule) | Re-auth on open; refresh session |

## References

- [docs/telegram/README.md](../../telegram/README.md)
- [docs/telegram/TECHNICAL.md](../../telegram/TECHNICAL.md)
- [docs/telegram/ROADMAP.md](../../telegram/ROADMAP.md)
- [btc-chart/trade-setup.md](../../btc-chart/trade-setup.md)