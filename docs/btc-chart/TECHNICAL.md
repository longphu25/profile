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
├── components/
│   ├── ChartHeader.tsx       # Symbol selector, intervals, price display
│   ├── IndicatorToolbar.tsx  # Toggle buttons for all overlays
│   ├── SignalPanel.tsx       # ML signal gauge
│   ├── SignalConfigPanel.tsx # Indicator selection + presets
│   ├── TradeSetupPanel.tsx   # Auto Entry/SL/TP from confluence
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
│   ├── useMarketData.ts   # Ticker, Funding, F&G, Klines, OI, Supply
│   ├── usePositions.ts    # Position CRUD + chart price lines
│   └── useOI.ts           # Open Interest aggregation
└── lib/
    ├── types.ts           # Shared domain types
    ├── constants.ts       # Chart palette, intervals, limits
    ├── symbols.ts         # Multi-exchange symbol registry
    ├── format.ts          # Price/volume formatters
    ├── indicators.ts      # Pure math: MHBand, SMA, RSI, MACD, ADX, etc.
    ├── ml.ts              # Weighted-ensemble ML signal
    ├── trade-setup.ts     # Auto Entry/SL/TP calculation
    ├── signal-config.ts   # Feature toggles + presets
    ├── boucher-scalping.ts # Jean-Francois Boucher M1 system
    ├── lien-reversal.ts   # Kathy Lien DBB reversal system
    ├── overlays.ts        # SMC + BoxFlip canvas drawing
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
                                    Boucher Scalping, Lien Reversal
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

## Configuration

Persisted to `localStorage` key `btc-chart:config:v1`:

- `interval`: Current timeframe
- `symbol`: Active trading pair
- `vis`: Visibility flags for all overlays (12 toggles + DBB)
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
