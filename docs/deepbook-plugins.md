# DeepBook Plugins Roadmap

Plugins derived from [depbuk-hedging](../../airdrop/depbuk-hedging) logic, adapted for the React + Vite plugin architecture in this project.

Reference source modules live under `depbuk-hedging/src/lib/server/bot/`.

---

## Plugin List

### 1. `sui-deepbook-orderbook` — Live Orderbook Widget

**Priority:** 🥇 | **Effort:** Medium

Real-time orderbook display for any DeepBook v3 pool.

- Best bid/ask, spread, mid-price
- Level 2 depth (top N ticks from mid)
- Mini price chart

**Reference:** `deepbook-market-data.ts` → `getOrderBookTopFromChain`, `midPrice`

---

### 2. `sui-swap` — Token Swap Widget

**Priority:** 🥇 | **Effort:** Medium

Swap tokens via 7K Meta Aggregator directly from the portfolio.

- Multi-DEX quote comparison (Cetus, FlowX, DeepBook, Bluefin)
- Best route selection
- Slippage protection UI

**Reference:** `deepbook-execution.ts` → `quoteWithAggregator`, `@7kprotocol/sdk-ts`

---

### 3. `sui-price-feed` — Live Price Oracle

**Priority:** 🥈 | **Effort:** Low

Live token prices from Pyth Network.

- Real-time SUI/USDC price
- Price change indicators
- Mini sparkline

**Reference:** `deepbook.ts` → `SuiPriceServiceConnection`, Pyth integration

---

### 4. `sui-deepbook-portfolio` — DeepBook Position Viewer

**Priority:** 🥈 | **Effort:** Medium

Read on-chain margin manager state for connected wallet.

- Open positions (long/short)
- Collateral deposited, borrowed amounts
- Unrealized PnL estimate from live mid-price

**Reference:** `deepbook-margin-state.ts` → `getManagerState`, `getManagerBalances`

---

### 5. `sui-deepbook-history` — Trade History Explorer

**Priority:** 🥉 | **Effort:** Medium

Query on-chain events by wallet address.

- Fill history (price, qty, side, timestamp)
- Volume traded, fees paid
- PnL per trade

**Reference:** `runtime-shared.ts` → `realizedTradingPnlUsdFromFilledOrders`, `sumCycleOrderFeesUsd`

---

### 6. `sui-pool-explorer` — DeepBook Pool Browser

**Priority:** 🥉 | **Effort:** Low

Browse all DeepBook v3 pools.

- Pool params (tick size, lot size, min size)
- Liquidity depth overview
- Fee tier info

**Reference:** `deepbook-market-data.ts`, `deepbook-shared.ts`

---

### 7. `sui-hedging-monitor` — Bot Status Dashboard

**Priority:** 4 | **Effort:** Low

Connect to a running hedging bot instance via its API.

- Bot lifecycle state (RUNNING/STOPPED/ERROR)
- Active cycle progress & hold timer
- Session PnL, volume, fees
- Start/Stop control

**Reference:** `runtime-snapshot.ts`, API routes `/api/bot/status`, `/api/bot/stream` (SSE)

---

### 8. `sui-margin-manager` — Margin Account Viewer

**Priority:** 4 | **Effort:** Medium

Detailed margin manager inspection for advanced users.

- Collateral balances (base/quote)
- Debt outstanding
- Available margin & liquidation risk

**Reference:** `deepbook-margin-state.ts`

---

## Implementation Notes

- All plugins follow the existing `Plugin` / `SuiHostAPI` interface in `src/plugins/types.ts`
- Each plugin lives in `plugins/<name>/` with `plugin.tsx` + `style.css`
- Dual-mode support: standalone (plugin-demo) or shared context (sui-dashboard)
- On-chain reads use `@mysten/sui` v2 (`SuiGrpcClient`) — already a project dependency
- DeepBook SDK: `@mysten/deepbook-v3` will need to be added as a dependency
- 7K Aggregator SDK: `@7kprotocol/sdk-ts` will need to be added for `sui-swap`
