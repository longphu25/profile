# Telegram Mini App: BTC Chart Alert

Lightweight Telegram Web App for **ML bias** and **Trade Setup plan** with **auto-login** via Telegram account.

## URL

After deploy (GitHub Pages):

```text
https://longphu25.github.io/profile/telegram-btc-alert.html
```

Local dev:

```bash
bun run dev
# open http://localhost:5173/telegram-btc-alert.html
```

## Auto-login flow

1. User chats with your bot (`/start`) and taps **Mở Chart Alert** (or the menu button).
2. Telegram injects `initData` into the Mini App with the signed user profile.
3. The app shows the Telegram name/avatar immediately.
4. When `VITE_CONVEX_SITE_URL` is set, the app POSTs `initData` to Convex `/telegram/auth` for a verified server session (7 days).

Outside Telegram (browser tab): user sees **Chưa đăng nhập** and a hint to open from the bot.

## Bot setup

### 1. Create bot

[@BotFather](https://t.me/BotFather) → `/newbot` → save `TELEGRAM_BOT_TOKEN`.

### 2. Run the bot (long polling)

```bash
export TELEGRAM_BOT_TOKEN="123456:ABC..."
export TELEGRAM_WEBAPP_URL="https://longphu25.github.io/profile/telegram-btc-alert.html"
bun apps/telegram/bot.mjs
```

Commands:

- `/start` — welcome + Web App button (auto-login when opened)
- `/chart` — same Web App button
- Menu button **Chart Alert** is set automatically on startup

### 3. BotFather menu (optional manual)

`/setmenubutton` → choose bot → **Configure menu button**

- Text: `Chart Alert`
- URL: `https://longphu25.github.io/profile/telegram-btc-alert.html`

### 4. Deep link with symbol and interval

```text
https://t.me/YourBot/chart?startapp=REUSDT_5m
/start REUSDT_5m
```

`start_param` formats: `BTCUSDT`, `REUSDT_5m`, `ETHUSDT-1h`

## Convex auth (verified sessions)

Set in the Convex dashboard (Settings → Environment variables):

```text
TELEGRAM_BOT_TOKEN=<same token as the bot>
CLIENT_ORIGIN=http://localhost:5173,https://longphu25.github.io,https://longphu.com
```

Deploy Convex:

```bash
bun run convex:deploy
```

Copy the **HTTP Actions** URL (ends with `.convex.site`) into the frontend build env:

```text
VITE_CONVEX_SITE_URL=https://your-deployment.convex.site
```

Rebuild and redeploy the static site so the Mini App can call `POST /telegram/auth`.

## What the Mini App runs

- Fetches klines (Binance futures, spot fallback)
- Lux NWE, ML, adaptive MA gate, Trade Setup votes
- **SMC WASM votes are not included** (too heavy for WebView). Use the full chart for SMC confluence.

## Polling

- Refreshes every **15 seconds**
- Haptic pulse when bias or plan changes

## Optional bot webhook (future)

Push Telegram messages when bias flips. Always validate `initData` server-side before trusting user identity for privileged actions.