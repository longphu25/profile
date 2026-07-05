# ADR: Telegram Mini App Data Backend (Turso + Convex)

**Status:** Accepted (July 2026)  
**Context:** Telegram BTC Chart Alert Mini App, shared with btc-chart plugin  
**Companion:** [telegram-data-backend.vi.md](./telegram-data-backend.vi.md)

## Problem

The Mini App runs on **GitHub Pages** (static). Telegram auto-login requires validating
`initData` with the bot token. User-specific data (prefs, alert subscriptions) must not
be writable from a read-only Turso token embedded in the client bundle.

The repo already operates:

- **Turso:** `coins` catalog for btc-chart (client read via `VITE_TURSO_*`)
- **Convex:** `marketSnapshots`, HTTP Actions, scheduled jobs (optional backend)

Question: can Telegram use **both** without splitting infrastructure?

## Decision

**Yes. Use Turso and Convex together with a strict split:**

| Data class | Store | Access path |
|------------|-------|-------------|
| Public coin catalog | Turso `coins` | Client read (`fetchCoinsFromTurso`) |
| Bot token, session secrets | Convex env only | Never in client |
| Telegram user profile + sessions | Convex tables | HTTP Actions after HMAC verify |
| User prefs, alert state | Convex tables (Phase 2) | HTTP Actions + Bearer token |
| Optional prefs mirror | Turso via Convex action | `TURSO_ADMIN_TOKEN` server-side only |
| Market snapshot cache | Convex `marketSnapshots` | HTTP GET, shared with chart |

Do **not** store sessions or bot tokens in Turso tables reachable from the Mini App read token.

## Rationale

### Why Turso for coins

- Already seeded and admin’d via `scripts/turso-coins.mjs`
- Same symbol routing (`mexc_symbol`, `okx_inst_id`) as full chart
- Read token is designed for public catalog exposure
- No Convex migration needed for Phase 1 coin picker

### Why Convex for auth and prefs

- `TELEGRAM_BOT_TOKEN` must stay server-side for HMAC validation
- HTTP Actions already deployed pattern (`/btc-chart/market`)
- Cron fits push-alert polling (Phase 3)
- Typed schema + indexes for `telegramId` lookups

### Why not Turso-only for Telegram

- Validating `initData` in a static page is impossible without exposing the bot token
- Turso read token cannot safely issue write sessions to arbitrary users from the browser

### Why not Convex-only for coins

- Duplicates existing Turso ops workflow and seed data
- Coin list changes are admin CLI today, not Convex dashboard

## Consequences

**Positive**

- One Turso source of truth for symbols across chart + Mini App
- One Convex deployment for auth, market cache, and future alerts
- Clear security boundary for agents and contributors

**Negative**

- Two env surfaces to configure for full production (Turso + Convex + bot host)
- Contributors must read [docs/telegram/TECHNICAL.md](../telegram/TECHNICAL.md) before adding user state

**Neutral**

- Mini App works offline-catalog (hardcoded symbols) when Turso unset
- Verified login optional when `VITE_CONVEX_SITE_URL` unset (local Telegram session only)

## Implementation notes

1. Frontend: only `VITE_*` for Turso read and Convex site URL.
2. Convex dashboard: `TELEGRAM_BOT_TOKEN`, `CLIENT_ORIGIN` includes GitHub Pages origin.
3. Bot host: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBAPP_URL` for `bot.mjs`.
4. Turso admin: `TURSO_ADMIN_TOKEN` only in CI/scripts, never Vite.

## Validation

| Check | Method |
|-------|--------|
| initData HMAC | `tests/unit/telegram-init-data.test.ts` |
| CORS preflight | `curl -X OPTIONS` against `.convex.site/telegram/auth` |
| Turso read from Mini App | Manual with `VITE_TURSO_*` in dev build |
| No bot token in dist | `rg TELEGRAM_BOT_TOKEN dist/` empty |

## References

- [docs/telegram/TECHNICAL.md](../telegram/TECHNICAL.md)
- [docs/telegram/ROADMAP.md](../telegram/ROADMAP.md)
- [btc-chart-exchange-backend.md](./btc-chart-exchange-backend.md)
- `plugins/btc-chart/lib/turso.ts`
- `apps/convex/convex/http.ts`