# Kathy Lien Double Bollinger Band Reversal System

## Origin

Based on Kathy Lien's Double Bollinger Band (DBB) strategy from "Day Trading and Swing Trading the Currency Market" and her FX Academy course. Adapted to crypto charting with zone-based reversal detection, squeeze analysis, and momentum exhaustion.

## Core Concepts

### 1. Double Bollinger Bands (DBB)

Two sets of Bollinger Bands on the same 20-period SMA:

- **Outer bands**: SMA +/- 2 standard deviations (strong trend zone)
- **Inner bands**: SMA +/- 1 standard deviation (momentum zone)

These create three distinct trading zones.

### 2. Three Zones

| Zone | Price Position | Interpretation |
|------|---------------|----------------|
| **Buy Zone** | Above +1SD | Strong bullish momentum, trend continuation |
| **Sell Zone** | Below -1SD | Strong bearish momentum, trend continuation |
| **Neutral Zone** | Between -1SD and +1SD | Range, consolidation, or reversal |

### 3. Reversal Detection

A reversal is triggered when price transitions between zones:

- **Bullish Reversal**: Price moves from Sell Zone to Neutral (or Buy)
- **Bearish Reversal**: Price moves from Buy Zone to Neutral (or Sell)

Confidence scoring (0-100) based on:

| Factor | Contribution |
|--------|-------------|
| Zone transition | +40 base |
| Band touch (outer band) | +20 |
| Candlestick confirmation | +15 |
| Squeeze breakout alignment | +15 |
| 3-bar momentum shift | +10 |

### 4. Bollinger Squeeze

Detects periods of unusually low volatility (bandwidth < 50% of 120-bar average):

- **Active squeeze**: Pulsing indicator, potential explosive move ahead
- **Breakout direction**: Determined when squeeze releases (price vs SMA)

### 5. Momentum Exhaustion

Detected when price touches the outer band but candle bodies are shrinking over the last 3 bars. Signals that the current trend push is fading.

### 6. Regime Classification

Based on how many of the last 8 bars stayed in one zone:

- **Trending Up**: 5+ bars in Buy Zone
- **Trending Down**: 5+ bars in Sell Zone
- **Range**: Neither condition met

### 7. ADR% Spent

Measures how much of the Average Daily Range (14-bar) has already been consumed by the current bar. Above 80% signals caution (limited further movement likely).

## Implementation

File: `plugins/btc-chart/lib/lien-reversal.ts`

```typescript
export function computeLienReversal(data: Candle[]): LienResult
```

Returns: `{ dbb, zone, prevZone, regime, squeeze, reversals, latestSignal, exhaustion, bandTouch, adrSpent }`

## Chart Integration

- **DBB Lines**: 5 line series on the price chart (SMA purple dashed, +/-2SD solid, +/-1SD dashed). Toggle with "DBB" toolbar button.
- **Markers**: `REV+` (blue arrow up) and `REV-` (purple arrow down) at reversal points
- **Sidebar Panel**: Collapsible with ON/OFF toggle
  - Compact: Shows zone + reversal signal + squeeze state
  - Expanded: All DBB levels, squeeze, exhaustion, band touch, ADR%, reversal detail with reasons

## Trade Setup Contribution

When enabled, Lien signals feed into the confluence-based Trade Setup:

- Latest reversal signal: +1 bull/bear
- High confidence reversal (>= 70): +1 additional
- Squeeze breakout: +1 in breakout direction
- Momentum exhaustion at band edge: +1 counter-trend
