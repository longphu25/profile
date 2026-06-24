# BTC Chart Plugin Documentation

Technical and user documentation for the BTC Chart Pro plugin.

## Documents

| File | Description |
|------|-------------|
| [TECHNICAL.md](./TECHNICAL.md) | Architecture, data flow, file structure, all indicators |
| [ml-signal.md](./ml-signal.md) | ML weighted-ensemble signal engine (15 features) |
| [trade-setup.md](./trade-setup.md) | Confluence-based Trade Setup (Entry/SL/TP) |
| [boucher-scalping.md](./boucher-scalping.md) | Jean-Francois Boucher M1 scalping system |
| [lien-reversal.md](./lien-reversal.md) | Kathy Lien Double Bollinger Band reversal system |
| [USER-GUIDE.md](./USER-GUIDE.md) | End-user guide (interface, features, mobile) |

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
Lien Exhaustion ────────────────────┘
```

### Supported Exchanges

Binance (futures + spot), Bybit, MEXC, OKX

### Timeframes

1m, 5m, 15m, 1h, 4h, 1d
