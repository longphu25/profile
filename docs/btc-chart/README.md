# BTC Chart Plugin Documentation

Technical and user documentation for the BTC Chart Pro plugin.

## Documents

| File | Description |
|------|-------------|
| [TECHNICAL.md](./TECHNICAL.md) | Architecture, data flow, file structure, all indicators |
| [wasm.md](./wasm.md) | WASM compute layer (SMC + NWE), timeframe-agnostic design, multi-TF |
| [ml-signal.md](./ml-signal.md) | ML weighted-ensemble signal engine (15 features) |
| [trade-setup.md](./trade-setup.md) | Confluence-based Trade Setup (Entry/SL/TP) |
| [boucher-scalping.md](./boucher-scalping.md) | Jean-Francois Boucher M1 scalping system |
| [lien-reversal.md](./lien-reversal.md) | Kathy Lien Double Bollinger Band reversal system |
| [luxalgo-nwe.md](./luxalgo-nwe.md) | LuxAlgo Nadaraya-Watson envelope |
| [nwe-strategies.md](./nwe-strategies.md) | NWE trading strategies |
| [USER-GUIDE.md](./USER-GUIDE.md) | End-user guide (interface, features, mobile) |
| [RESEARCH-2026-07.md](./RESEARCH-2026-07.md) | July 2026 research: SMC, deploy, mobile, OI, Convex vs Worker |
| [multi-exchange-data.md](./multi-exchange-data.md) | 4-venue data catalog, aggregates beyond OI, phased plan |

Also: ICT Sessions (`lib/ict-sessions.ts`) and ICT Liquidity Hacks
(`lib/liquidity.ts`) — documented inline in `TECHNICAL.md`.

## Quick Reference

### Trading Systems

1. **ML Signal**: Weighted ensemble of 15 indicators, configurable via presets
2. **Boucher M1 Scalping**: ATR-based box framing, 3-bar reversal, ladder levels, speed reading
3. **Kathy Lien Reversal**: Double Bollinger Bands, zone transitions, squeeze, exhaustion

### How They Work Together

All three systems feed into the **Trade Setup** confluence engine:

```
ML Signal (score > 0.65 or < 0.35) ─┐
RSI (< 35 or > 65) ─────────────────┤
NWE Zone (at band edge) ────────────┤
ADX (>= 25 trending) ──────────────┤
                                     ├──→ Trade Setup (need 2+ aligned)
Boucher Entry (last 3 bars) ────────┤      → Entry, SL, TP, Confidence
Boucher 3-Bar Reversal ─────────────┤
Boucher Box Speed ──────────────────┤
                                     │
Lien Reversal Signal ───────────────┤
Lien High Confidence ───────────────┤
Lien Squeeze Breakout ──────────────┤
Lien Exhaustion ────────────────────┤
                                     │
Lux NWE Cross / band ───────────────┤
ICT Judas Swing (+ VOL) ────────────┤
ICT Liquidity Sweep (+ killzone) ───┘
```

The **"?"** button on the Trade Setup panel opens an explanation modal that
translates every one of these reasons into plain language (bull / bear /
context) and includes a glossary of all indicators. See `TECHNICAL.md`.

### Supported Exchanges

Binance (futures + spot), Bybit, MEXC, OKX

### Timeframes

1m, 5m, 15m, 1h, 4h, 1d
