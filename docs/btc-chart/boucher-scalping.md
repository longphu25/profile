# Boucher M1 Scalping System

## Origin

Based on Jean-Francois Boucher's range-scalping methodology (Jasper4x). Adapted from forex (EUR/USD, 9-pip fixed box) to crypto (BTC/USDT, ATR-dynamic box).

## Core Concepts

### 1. ATR-Based Box Framing

Instead of a fixed pip value, the box size equals ATR(14) on the current timeframe. This adapts automatically to BTC volatility.

- **Box** = one ATR unit of vertical price movement
- Price stepping above a box creates a new box above
- Price stepping below creates a new box below
- Historical boxes are tracked for speed analysis

### 2. Three-Bar Reversal Trigger

The primary entry signal. Detects momentum flips at box edges:

- **Long**: Bar 1 bearish, Bar 2 neutral, Bar 3 bullish that closes above Bar 1's high (apex)
- **Short**: Bar 1 bullish, Bar 2 neutral, Bar 3 bearish that closes below Bar 1's low (nadir)

Only triggers detected within the last 60 bars are shown as chart markers (`3B+` / `3B-`).

### 3. Ladder Levels

Auto-generated S/R levels spaced by box size from recent swing high/low center:

- Levels with 0 touches are filtered out
- Sorted by price descending
- Role assigned relative to current price (support below, resistance above)
- Touch count indicates strength

### 4. Entry Signals (Sell Green / Buy Red)

Qualified entries at ladder levels:

- **Sell**: Green candle (close > open) touching resistance level within 0.3 box threshold
- **Buy**: Red candle (close < open) touching support level within 0.3 box threshold
- `confirmed: true` when a three-bar reversal coincides

### 5. Speed Reading

Box traversal speed relative to median:

- **Fast** (< 60% of median bars): Momentum continuation expected
- **Slow** (> 150% of median bars): Mean-reversion territory
- **Normal**: Standard conditions

### 6. Risk Management

- **Envelope**: 4 boxes from entry (hard stop, account protection)
- **Target**: 1 ATR (quick, repeatable pay)
- **Win Rate**: Backtested against recent signals (5-bar forward check)

## Implementation

File: `plugins/btc-chart/lib/boucher-scalping.ts`

```typescript
export function computeBoucherScalping(data: Candle[]): BoucherResult
```

Returns: `{ atr, boxSize, currentBox, boxes, ladder, threeBar, entries, envelope, target, speed, stats }`

## Chart Integration

- **Markers**: `3B+` (green arrow up) and `3B-` (amber arrow down) on candlestick chart
- **Sidebar Panel**: Collapsible with ON/OFF toggle
  - Compact: Shows speed + last signal direction + WR%
  - Expanded: Full metrics, box, entry, stats, ladder levels

## Trade Setup Contribution

When enabled, Boucher signals feed into the confluence-based Trade Setup:

- Recent entry signal (within last 3 bars): +1 bull/bear
- Three-bar reversal: +1 bull/bear
- Fast box speed with aligned entry: +1 bull/bear
