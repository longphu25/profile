# DeepBook Plugins Roadmap

Plugins derived from [depbuk-hedging](../../airdrop/depbuk-hedging) logic, adapted for the React + Vite plugin architecture in this project.

Reference source modules live under `depbuk-hedging/src/lib/server/bot/`.

---

## Status Overview

| # | Plugin | Status | Commit |
|---|--------|--------|--------|
| 1 | `sui-pool-explorer` | ✅ Done | `6133100` |
| 2 | `sui-price-feed` | ✅ Done | `2c90905` |
| 3 | `sui-deepbook-portfolio` | ✅ Done | `4aee8f2` |
| 4 | `sui-deepbook-history` | ✅ Done | `03e357b` |
| 5 | `sui-swap` | ✅ Done | `7483cf1` |
| 6 | `sui-deepbook-orderbook` | ✅ Done | `ff6c840` |
| 7 | `sui-hedging-monitor` | ❌ Not started | — |
| 8 | `sui-margin-manager` | ❌ Not started | — |

Host API: `signAndExecuteTransaction` added in `0ea4c8f`
Deps + vite config: `6b2e0fd` (v0.20.0)
WASM dashboard registration: `5c736cd`

---

## ✅ Completed Plugins

### 1. `sui-pool-explorer` — DeepBook Pool Browser

**Priority:** 🥉 | **Effort:** Low | **Status:** ✅ Done

Browse all DeepBook v3 pools with live data from the public indexer.

- Fetches `/get_pools`, `/summary`, `/ticker` in parallel
- Sortable table: price, 24h change, volume, spread
- Click-to-expand detail panel with tick/lot/min size
- Mini orderbook (top 5 bids + asks) on demand
- Network toggle (mainnet/testnet), search filter
- Active/Frozen status badges

**Data source:** DeepBook Indexer REST API (no SDK needed)

---

### 2. `sui-price-feed` — Live Price Feed

**Priority:** 🥈 | **Effort:** Low | **Status:** ✅ Done

Live token prices with OHLCV sparkline charts.

- Price cards grid (top 12 pairs by volume)
- ASCII sparkline chart from `/ohclv` endpoint
- Interval selector: 1h, 4h, 1d, 1w
- Auto-refresh every 30s
- High/Low/Volume stats per candle range

**Data source:** DeepBook Indexer `/summary`, `/ohclv/:pool`

---

### 3. `sui-deepbook-portfolio` — DeepBook Position Viewer

**Priority:** 🥈 | **Effort:** Medium | **Status:** ✅ Done

View margin positions, collateral, LP, and DeepBook points for any wallet.

- Input wallet address or auto-sync from connected wallet
- Summary cards: Total Equity, Total Debt, Net Value
- Tables: Margin Positions (with risk ratio), Collateral Balances, LP Positions
- DeepBook Points badge (⚡ pts)

**Data source:** DeepBook Indexer `/portfolio/:address`, `/get_points`

---

### 4. `sui-deepbook-history` — Trade History Explorer

**Priority:** 🥉 | **Effort:** Medium | **Status:** ✅ Done

Browse recent trades on DeepBook v3 per pool.

- Pool dropdown from `/get_pools`
- Optional balance manager ID filter
- Stats: trade count, base/quote volume, total fees
- Table: time, side (BUY/SELL badge), price, qty, fee breakdown, tx link to Suiscan

**Data source:** DeepBook Indexer `/trades/:pool`, `/get_pools`

---

### 5. `sui-swap` — Token Swap Widget

**Priority:** 🥇 | **Effort:** Medium | **Status:** ✅ Done

Swap tokens via DeepBook v3 with real on-chain transaction signing.

- Orderbook-based output estimation (market order simulation)
- Builds swap tx via `@mysten/deepbook-v3` SDK
  - `swapExactQuoteForBase` (buy) / `swapExactBaseForQuote` (sell)
- Signs via `SuiHostAPI.signAndExecuteTransaction`
- Slippage selector (0.1%, 0.5%, 1.0%), min received display
- Price impact warning, success state with Suiscan tx link
- Pool SDK compatibility check for unsupported pools
- Mini orderbook (top 5 bids + asks)

**Data source:** DeepBook Indexer `/get_pools`, `/ticker`, `/orderbook/:pool` + `@mysten/deepbook-v3` SDK

---

## ❌ Not Started

### 6. `sui-deepbook-orderbook` — Live Orderbook Widget

**Priority:** 🥇 | **Effort:** Medium | **Status:** ✅ Done

Full-featured live Level 2 orderbook display.

- Pool selector with all available pools
- Depth selector: 10, 20, 50 levels
- Auto-refresh: 3s, 5s, 10s, or manual (live pulse indicator)
- Mid-price banner with absolute + percentage spread
- Cumulative depth chart (bid/ask volume bars)
- Level 2 book: price, size, cumulative total with background volume bars

**Data source:** DeepBook Indexer `/orderbook/:pool`, `/get_pools`

---

### 7. `sui-hedging-monitor` — Bot Status Dashboard

**Priority:** 4 | **Effort:** Low

Connect to a running depbuk-hedging bot instance via its API.

- Bot lifecycle state (RUNNING/STOPPED/ERROR)
- Active cycle progress & hold timer
- Session PnL, volume, fees
- Start/Stop control

**Reference:** `runtime-snapshot.ts`, API routes `/api/bot/status`, `/api/bot/stream` (SSE)

**Note:** Requires the hedging bot to be running and accessible. Niche use case — only useful when actively running the bot.

---

### 8. `sui-margin-manager` — Margin Account Viewer

**Priority:** 4 | **Effort:** Medium

Detailed margin manager inspection for advanced users.

- Collateral balances (base/quote)
- Debt outstanding
- Available margin & liquidation risk indicator
- Open orders list

**Reference:** `deepbook-margin-state.ts`

**Note:** Some of this data is already available in `sui-deepbook-portfolio` via the `/portfolio/:address` endpoint. This plugin would add deeper on-chain reads via DeepBook SDK for real-time manager state.

---

## Implementation Notes

- All plugins follow the existing `Plugin` / `SuiHostAPI` interface in `src/plugins/types.ts`
- Each plugin lives in `plugins/<name>/` with `plugin.tsx` + `style.css`
- Dual-mode support: standalone (plugin-demo) or shared context (sui-dashboard)
- On-chain reads use `@mysten/sui` v2 (`SuiGrpcClient`) — already a project dependency
- `@mysten/deepbook-v3` added as dependency (used by `sui-swap`)
- All 5 completed plugins registered in `SuiWasmDashboard` (ESM badge)
- `SuiHostAPI.signAndExecuteTransaction` added for wallet-signed transactions
