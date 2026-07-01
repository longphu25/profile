# BTC Chart Plugin - Technical Documentation

## Overview

Professional-grade real-time cryptocurrency charting plugin with multi-exchange support, advanced technical analysis, and two proprietary trading systems integrated for signal generation.

## Architecture

```
plugins/btc-chart/
├── plugin.tsx              # Plugin entry, React root, chart + WS wiring
├── style.css              # Scoped styles (Shadow DOM)
├── storage.ts             # LocalStorage config persistence
├── alerts.ts              # Price/RSI alert engine + notifications
├── snapshot.ts            # Chart screenshot export
├── volume-profile.ts      # Volume Profile overlay renderer
├── order-flow-overlay.ts  # Order Flow canvas overlay
├── smc.ts / smc-wasm.ts   # Smart Money Concepts (WASM-accelerated)
├── box-flip.ts            # Box Flip signal detection
├── wasm/                  # Rust → WASM (compute_smc, compute_nwe). See wasm.md
├── components/
│   ├── ChartHeader.tsx       # Symbol selector, intervals, price display
│   ├── IndicatorToolbar.tsx  # Toggle buttons for all overlays
│   ├── SignalPanel.tsx       # ML signal gauge
│   ├── SignalConfigPanel.tsx # Indicator selection + presets
│   ├── TradeSetupPanel.tsx   # Auto Entry/SL/TP (collapsible) + "?" explain button
│   ├── ExplainModal.tsx      # "Why this Trade Setup?" popup + indicator glossary
│   ├── SessionsPanel.tsx     # ICT sessions / Judas / ADR (collapsible)
│   ├── LiquidityPanel.tsx    # ICT liquidity: range, BSL/SSL, sweeps (collapsible)
│   ├── ScalpingPanel.tsx     # Boucher M1 system (collapsible)
│   ├── ReversalPanel.tsx     # Kathy Lien DBB system (collapsible)
│   ├── PositionsPanel.tsx    # Manual position tracker
│   ├── AlertsPanel.tsx       # Price alert management
│   ├── MarketPanels.tsx      # Funding, Stats, Fear&Greed
│   ├── IndicatorReadouts.tsx # OF, BoxFlip, MHBand, VP readouts
│   ├── TechnicalsPanel.tsx   # All technical signals summary
│   ├── VolumeSpikePanel.tsx  # Volume spike threshold config
│   └── OIPanel.tsx           # Open Interest + Market Cap
├── hooks/
│   ├── useMarketData.ts   # Ticker, Funding, F&G, Klines (+ HTF), OI, Supply
│   ├── usePositions.ts    # Position CRUD + chart price lines
│   └── useOI.ts           # Open Interest aggregation
└── lib/
    ├── types.ts           # Shared domain types
    ├── constants.ts       # Chart palette, intervals, limits
    ├── symbols.ts         # Multi-exchange symbol registry
    ├── format.ts          # Price/volume formatters
    ├── indicators.ts      # Pure math: MHBand, SMA, RSI, MACD, ADX, etc.
    ├── nadaraya-watson.ts # LuxAlgo NWE (JS fallback for WASM compute_nwe)
    ├── ml.ts              # Weighted-ensemble ML signal
    ├── trade-setup.ts     # Auto Entry/SL/TP calculation (confluence engine)
    ├── explain.ts         # Reason → plain-language map + indicator glossary
    ├── signal-config.ts   # Feature toggles + presets
    ├── boucher-scalping.ts # Jean-Francois Boucher M1 system
    ├── lien-reversal.ts   # Kathy Lien DBB reversal system
    ├── ict-sessions.ts    # ICT sessions (Asia/London/NY) + Judas Swing
    ├── liquidity.ts       # ICT liquidity hacks: range, ext/int, IFVG, sweeps
    ├── overlays.ts        # SMC + BoxFlip + ICT + Liquidity canvas drawing
    ├── positions.ts       # Position math (PnL, suggestions)
    └── api.ts             # REST API fetch helpers
```

## Data Flow

```
Binance/Bybit/MEXC/OKX REST API (historical klines)
        │
        ▼
  React Query (useKlines) → candlesRef → renderData()
        │                                      │
        ▼                                      ▼
  WebSocket (live ticks) ──────────────→ Update candles + chart series
                                               │
                                               ▼
                                    Compute all indicators:
                                    MHBand, SMA, RSI, MACD, ADX,
                                    StochRSI, OBV, VWAP, Divergence,
                                    Boucher Scalping, Lien Reversal,
                                    SMC (WASM), NWE (WASM),
                                    ICT Sessions, ICT Liquidity
                                               │
                                               ▼
                                    ML Signal (weighted ensemble)
                                               │
                                               ▼
                                    Trade Setup (confluence)
                                               │
                                               ▼
                                    setState → Sidebar panels
```

## Multi-Timeframe (HTF)

The ICT Liquidity feature anchors its trading range on a **higher timeframe**
than the one being viewed. A second `useKlines(symbol, htfInterval, info)` call
fetches HTF candles; React Query caches it independently (keyed by interval).
`HTF_MAP` (in `lib/liquidity.ts`) maps one level up:

```
1m → 15m,  5m → 1h,  15m → 1h,  1h → 4h,  4h → 1d,  1d → (none)
```

The HTF candles reach `renderData` through `htfRef` (mirror-ref pattern, since
`renderData` has an empty dependency array). **WASM is not involved in the
timeframe logic** — it is timeframe-agnostic and simply computes on whatever
candle array it is handed. See [`wasm.md`](./wasm.md) for details.

## WASM Compute Layer

Two heavy computations run in Rust → WASM with transparent JS fallback:
`compute_smc` (BOS/CHoCH, Order Blocks, FVG) and `compute_nwe` (LuxAlgo
Nadaraya-Watson envelope). Loaded once via `initSmcWasm()`; if unavailable, the
pure-JS paths in `smc.ts` / `nadaraya-watson.ts` take over with identical
signatures. Full detail in [`wasm.md`](./wasm.md).

## Supported Exchanges

| Exchange | Data | WebSocket | Symbol Format |
|----------|------|-----------|---------------|
| Binance Futures | REST + WS | fstream.binance.com | BTCUSDT |
| Binance Spot | REST + WS | stream.binance.com | BTCUSDT (fallback) |
| Bybit | REST + WS | stream.bybit.com | BTCUSDT |
| MEXC | REST + WS | contract.mexc.com | BTC_USDT |
| OKX | REST + WS | ws.okx.com | BTC-USDT |

## Timeframes

`1m`, `5m`, `15m`, `1h`, `4h`, `1d`

## Indicators

| Indicator | Source | Purpose |
|-----------|--------|---------|
| Midnight Hunter Band | X48 TMA + ATR envelope | Trend channel |
| SMA 50/200 | Classic | Trend direction + crosses |
| RSI (14) | Wilder | Momentum, overbought/oversold |
| MACD (12/26/9) | Standard | Momentum + acceleration |
| ADX/DMI (14) | Wilder | Trend strength + direction |
| Stochastic RSI | RSI + Stochastic | Fast momentum timing |
| OBV | Cumulative | Volume flow confirmation |
| VWAP + bands | Anchored | Institutional reference |
| RSI Divergence | Pivot comparison | Reversal detection |
| Volume Profile | Histogram | S/R from volume |
| Order Flow | NWE rebound | Buy/sell pressure |
| SMC | Structure + OB + FVG | Smart money levels |
| Box Flip | Range breakout | Breakout signals |
| Double Bollinger Bands | 20 SMA +/- 1SD, 2SD | Zone classification |
| Lux NWE | LuxAlgo Nadaraya-Watson (WASM) | Envelope crosses + bias |
| ICT Sessions | Asia/London/NY decode + Judas Swing | Session liquidity + stop-hunt |
| ICT Liquidity | Trading range, ext/int liquidity, IFVG, sweeps | Smart-money liquidity draw |

## Configuration

Persisted to `localStorage` key `btc-chart:config:v1`:

- `interval`: Current timeframe
- `symbol`: Active trading pair
- `vis`: Visibility flags for all overlays (incl. `smc`, `ict`, `liquidity`, `luxNwe`)
- `zoom`: Last viewport range
- `alerts`: Price/RSI alert rules
- `sound`: Alert sound enabled + volume
- `notifications`: Browser notification permission
- `oscOpen/oscView/oscHeight`: Oscillator pane state
- `spikeMult`: Volume spike threshold multiplier
- `signalConfig`: Which features are enabled for ML signal

## Signal Config Presets

| Preset | Features | Style |
|--------|----------|-------|
| Full (All) | All 15 indicators | Maximum accuracy |
| Trend Following | MA50, MA200, Cross, ADX, MACD, Mom | Catch trends |
| Mean Reversion | NWE, RSI, StochRSI, Divergence, OBV | Catch reversals |
| Scalping M1 | VWAP, Vol, Mom, RSI, StochRSI | Short trades |
| Volume Flow | OBV, VWAP, VolSpike, ADX, Mom | Follow money |
| Momentum | RSI, MACD, Mom, StochRSI, ADX | Push strength |
| Conservative | MA50, Cross, RSI, ADX | Few, high quality |

## Trade Setup Confluence + Explanation

`calcTradeSetup` (`lib/trade-setup.ts`) counts bull/bear votes across every
source (ML, RSI, NWE, ADX, Boucher, Lien, Lux NWE, ICT Judas, ICT Liquidity),
collecting a `reasons: string[]`. Direction requires ≥2 votes on the winning
side; `confidence = min(100, winningVotes×20 + voteMargin×10)`.

The **"?" button** in the Trade Setup panel opens `ExplainModal`, which:
- groups every reason into bull / bear / context with a Vietnamese explanation
  (`explainReason` in `lib/explain.ts`),
- shows the confidence math and Entry/SL/TP levels,
- lists a glossary for every indicator (`INDICATOR_DOCS`).

The modal renders **inline** (not via `createPortal(document.body)`) because the
plugin lives in a Shadow DOM — a body portal would escape the scoped stylesheet.

## ICT: Sessions + Liquidity

- **ICT Sessions** (`lib/ict-sessions.ts`): decodes Asia/London/NY sessions from
  UTC candle time, tracks each session's high/low (liquidity pools), detects the
  London **Judas Swing** (sweep of Asian liquidity + rejection), and ADR% spent.
  Killzones are fixed UTC; intraday-only (empty on 4h/1d).
- **ICT Liquidity** (`lib/liquidity.ts`): four "liquidity hacks" — (1) trading
  range from the HTF with premium/discount equilibrium, (2) external (BSL/SSL)
  vs internal (FVG) liquidity classification, (3) dynamic FVG → inverse-FVG
  flips, (4) liquidity sweeps of the range edges (strongest inside a killzone).
  Feeds `TradeSetupExtra.liquidity` for confluence and draws its own overlay.

Both draw range-bounded overlays (not full-height bands) to keep the chart
readable. All three ICT/SMC overlays redraw on scroll **and** resize
(`syncSize`).
