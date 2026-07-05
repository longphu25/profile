# Telegram BTC Chart Alert

Documentation for the Telegram Mini App that surfaces **ML bias** and **Trade Setup**
from the btc-chart plugin, with **Telegram auto-login**.

## Documents

| File | Description |
|------|-------------|
| [TECHNICAL.md](./TECHNICAL.md) | Architecture, auth flow, Turso/Convex roles, file map, env vars |
| [ROADMAP.md](./ROADMAP.md) | Phased next steps: Turso coins, user prefs, push alerts, SMC parity |
| [../decisions/telegram-data-backend.md](../decisions/telegram-data-backend.md) | ADR: Turso vs Convex for Telegram data |
| [../stories/plans/24-telegram-btc-alert.md](../stories/plans/24-telegram-btc-alert.md) | Story plan and shipped scope (v0.115.0–v0.116.0) |

## Operational quickstart

See also `apps/telegram/README.md` in the repo root for BotFather steps and
one-command bot launch (`bun run telegram:bot`).

## URLs

| Environment | URL |
|-------------|-----|
| Production (GitHub Pages) | `https://longphu25.github.io/profile/telegram-btc-alert.html` |
| Local dev | `http://localhost:5173/telegram-btc-alert.html` |
| Full chart deep link | `{origin}{base}/btc-chart.html` |

## Shipped (v0.115.0–v0.116.0)

- Vite entry `telegram-btc-alert.html` + `src/telegram-btc-alert/`
- Poll every 15s: Lux NWE + ML + adaptive MA gate + Trade Setup votes (no SMC WASM)
- Telegram WebApp theme, haptic on bias/plan change
- Auto-login: `initData` user bar + optional Convex `/telegram/auth`
- Long-polling bot: `/start`, `/chart`, menu button `Chart Alert`
- Convex tables: `telegramUsers`, `telegramSessions`

## Related btc-chart docs

- [btc-chart/README.md](../btc-chart/README.md)
- [btc-chart/trade-setup.md](../btc-chart/trade-setup.md)
- [btc-chart/ml-signal.md](../btc-chart/ml-signal.md)
- [decisions/btc-chart-exchange-backend.md](../decisions/btc-chart-exchange-backend.md)