# Trade Setup - Confluence Engine

## Overview

The Trade Setup engine automatically calculates Entry, Stop Loss, and Take Profit levels based on multi-system signal confluence. It aggregates signals from:

1. **ML Signal Engine** (weighted indicator ensemble)
2. **Boucher M1 Scalping** (box, 3-bar reversal, speed)
3. **Kathy Lien Reversal** (DBB zone transition, squeeze, exhaustion)

## Decision Logic

### Signal Sources

| Source | Bullish Condition | Bearish Condition |
|--------|-------------------|-------------------|
| ML Score | >= 0.65 | <= 0.35 |
| RSI | < 35 (oversold) | > 65 (overbought) |
| NWE Zone | Price at lower band | Price at upper band |
| ADX | >= 25 (confirms trend) | >= 25 (confirms trend) |
| Boucher Entry | Long signal (last 3 bars) | Short signal (last 3 bars) |
| Boucher 3-Bar | Long reversal (last 3 bars) | Short reversal (last 3 bars) |
| Boucher Speed | Fast + aligned entry | Fast + aligned entry |
| Lien Reversal | Bullish reversal signal | Bearish reversal signal |
| Lien High Conf | Confidence >= 70 | Confidence >= 70 |
| Lien Squeeze | Breakout up | Breakout down |
| Lien Exhaustion | At lower band | At upper band |

### Direction Decision

- **Need minimum 2 signals** in one direction
- Bull count must exceed bear count (or vice versa)
- If neither condition met: "No confluence"

### Confidence Calculation

```
confidence = min(100, max(bull, bear) * 20 + abs(bull - bear) * 10)
```

Higher when more signals agree and the margin between bull/bear is larger.

### Stop Loss

- **Long**: min(swing low of last 20 bars, NWE lower band) * 0.998
- **Short**: max(swing high of last 20 bars, NWE upper band) * 1.002

### Take Profit

- **TP1**: 2x risk from entry (1:2 R:R)
- **TP2**: NWE opposite band or 3x risk (whichever is more favorable)

## Signal Config Integration

The ML Signal engine respects the `SignalConfig`:

- Users can enable/disable individual features (15 total)
- Disabled features are excluded from the weighted score
- This affects the ML score, which in turn affects Trade Setup

The Boucher and Lien systems can be independently toggled ON/OFF via their panel buttons, but their signals always feed into Trade Setup computation regardless of UI toggle (the toggle only affects chart markers and panel display).

## UI

The Trade Setup panel shows:

- Direction (LONG/SHORT) with color coding
- Confidence percentage
- **Capital input** (default $10) + **Leverage input** (1-125x, default x10)
- Entry, SL, TP1, TP2 price levels with risk %
- Calculated position details:
  - Size (capital * leverage)
  - Quantity (size / entry)
  - Loss at SL ($)
  - Profit at TP1/TP2 ($)
  - Liquidation price
- Signal reasons grouped by source:
  - **Indicators** (green-gray tags): ML, RSI, ADX, NWE
  - **Boucher** (mint tags): Entry, 3-Bar, Box Speed
  - **Lien** (blue tags): Reversal, High Conf, Squeeze, Exhaustion
- Total signal count

## File

`plugins/btc-chart/lib/trade-setup.ts`

```typescript
export function calcTradeSetup(
  data: Candle[],
  nwe: NWE,
  rsi: (number | null)[],
  adx: { adx: (number | null)[] },
  ml: MLResult,
  extra?: { boucher?: BoucherResult; lien?: LienResult },
): TradeSetup
```
