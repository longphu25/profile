# Session Context — 2026-06-01 → 2026-06-02

## BTC Chart Plugin (`plugins/btc-chart/`)

### Midnight Hunter Band (thay NWE)
- Đổi từ LuxAlgo NWE (Gaussian kernel + MAD) sang **X48 Midnight Hunter V.1** (centered TMA + ATR bands)
- Source Pine: `docs/deepbook/Indicator-x48.source`
- Params: `halfLen=56, atrPeriod=110, atrMult=2.5`
- Repainting (symmetric kernel, like original)
- Signal logic: **rebound** — prev bar pokes band + current bar reverses

### Order Flow Overlay
- Pills anchor trên NWE/MH band (không phải gutter cố định)
- Dotted leader line trỏ tới candle wick (high/low)
- Fixed: sort+dedup timestamps trước `series.setData()`

### Multi-Symbol Support
- Dropdown chọn: BTC/USDT, ETH/USDT, SOL/USDT, LAB/USDT
- Exchange routing: `binance` | `bybit` | `mexc`
- LAB dùng **MEXC Futures** (contract API) cho klines, WS, ticker
- MEXC REST proxy qua Vite (`/api/mexc/*` → `contract.mexc.com`)
- WS: `wss://contract.mexc.com/edge` (subscribe `sub.kline`)

### Funding Rate
- Aggregate từ 4 sàn: MEXC + Binance + OKX + Bybit
- Hiện average + breakdown per-exchange
- Sentiment badge: Long heavy / Balanced / Short heavy

### Position Tracker
- User nhập vị thế: side, type (isolated/cross), entry, size, margin, SL
- PnL real-time (cập nhật theo WS price)
- Giá thanh lý ước tính (isolated)
- Chart price lines: entry (xanh/đỏ) + SL (vàng đứt)
- Persist localStorage `btc-chart:positions`

### Persist Config
- `symbol` + `interval` lưu localStorage
- Ghi **synchronous** ngay khi user chọn (không chờ throttle 250ms)

### Sidebar Order
Signal → Funding rate → Positions → 24h stats → MH signals → MH Band → Alerts → Technicals → Features → Volume Profile → Fear & Greed

### Loading Animation
- Fade-out overlay + staggered reveal (header → toolbar → body)
- `prefers-reduced-motion` respected

---

## DeepBook Predict Plugin (`plugins/sui-deepbook-predict/`)

### Refactor Completed
- `PredictPluginRoot.tsx`: 2030 → 1276 lines
- Extracted: `SurfaceStudio.tsx`, `PLPRiskDashboard.tsx`, `VaultPanel.tsx`
- `application/tradeActions.ts`: `buildCreateManager` + `buildTradeTx`
- `application/usePositionOverlays.ts`: cache keyed by manager/oracle/refresh, fixes infinite loop
- `domain/positions.ts`: added `mergeOverlays()`
- Tests: 16 pass (`domain.test.js` + `positions.test.js`)

### Chart Fixes
- `subscribeVisibleLogicalRangeChange` for overlay tracking on pan/zoom
- Guard binary select when `spot = 0`
- Sort + dedup timestamps before `setData()`

### ChartTradePopup
- `ChartTradeDraft` type in `domain/types.ts`
- `PredictPositionChart` emits drafts via `onDraft` prop
- Popup: amount input, fair-value preview, wallet-required guard, confirm mint
- Wired into TradePanel using shared `buildTradeTx`

### Keeper / Portfolio Fixes
- Keeper "Claim All": one-by-one instead of batch (stale data won't abort all)
- Portfolio "Claim": friendly error for already-redeemed positions

### Standalone Page
- `deepbook-predict.html` + `src/deepbook-predict/` (same pattern as btc-chart.html)
- Full-screen plugin in ShadowContainer, no external chrome

### Regression Checklist
- `plugins/sui-deepbook-predict/REGRESSION.md`

### Backlog (in plan 11)
- P0: Visual QA ✅, Chart data states ✅ (partial), Regression checklist ✅
- P1: Items 2-5 (extraction) — 3,4,5 done; 2+13 (TradePanel) next
- P2: Date.now purity, Portfolio overlay, clean arch layers

---

## Version History
- 0.27.2 → 0.28.2 (NWE→MH, chart fixes, loading reveal)
- 0.28.2 → 0.31.4 (predict refactor, chart QA, tradeActions, extraction)
- 0.31.4 → 0.34.1 (standalone page, multi-symbol, MEXC, position tracker)

## Key Decisions
- LAB/USDT uses MEXC Futures (user trades there)
- MEXC contract API needs vite proxy (CORS blocked)
- Funding rate: simple average across all available exchanges
- Price source: MEXC ticker for LAB (not Binance futures)
- Positions are user-entered (not from exchange API)
