# Telegram Mini App: BTC Chart Alert

Lightweight Telegram Web App for **ML bias** and **Trade Setup plan** without the full chart WASM stack.

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

## BotFather setup

1. Create a bot: [@BotFather](https://t.me/BotFather) → `/newbot`
2. Set Mini App menu: `/setmenubutton` → choose bot → **Configure menu button**
   - Text: `Chart Alert`
   - URL: `https://longphu25.github.io/profile/telegram-btc-alert.html`
3. Optional deep link with symbol and interval:
   - `https://t.me/YourBot/chart?startapp=REUSDT_5m`
   - `start_param` formats: `BTCUSDT`, `REUSDT_5m`, `ETHUSDT-1h`

## What it runs

- Fetches klines (Binance futures, spot fallback)
- Same engine as the chart plugin: Lux NWE, ML (Lux+SMC preset), adaptive MA gate, Trade Setup votes
- **SMC WASM votes are not included** in the Mini App (too heavy for WebView). Use the full chart for SMC confluence.

## Polling

- Refreshes every **15 seconds**
- Haptic pulse in Telegram when bias or plan changes

## Optional bot webhook (future)

Use a Bun/Node bot to push messages when bias flips. Validate `initData` server-side before trusting Telegram user identity.