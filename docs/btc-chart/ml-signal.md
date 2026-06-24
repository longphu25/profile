# BTC Chart - ML Signal Engine

## Overview

A weighted-ensemble scoring system that combines 15 technical features into a single 0-1 score with a directional label (STRONG BUY, BUY, NEUTRAL, SELL, STRONG SELL).

## Features

| Key | Label | Weight | Bullish | Bearish |
|-----|-------|--------|---------|---------|
| NWE_pos | Band Position | 1.5 | Price near lower band | Price near upper band |
| Price>NWE_mid | P>Mid | 2.0 | Close > NWE midline | Close < NWE midline |
| Price>MA50 | P>MA50 | 1.5 | Close > SMA50 | Close < SMA50 |
| Price>MA200 | P>MA200 | 1.0 | Close > SMA200 | Close < SMA200 |
| MA50>MA200 | MA50/200 | 2.0 | Golden cross | Death cross |
| RSI | RSI | 2.0 | RSI < 30 (oversold) | RSI > 70 (overbought) |
| MACD_hist | MACD | 1.5 | Histogram > 0 | Histogram < 0 |
| MACD_acc | MACD Acc | 1.0 | Hist increasing | Hist decreasing |
| Mom5 | Mom5 | 1.0 | 5-bar return positive | 5-bar return negative |
| VolSpike | VolSpike | 0.8 | Spike + green candle | Spike + red candle |
| ADX | ADX/DMI | 2.0 | ADX>20 + DI+ > DI- | ADX>20 + DI- > DI+ |
| StochRSI | StochRSI | 1.2 | %K < 20 (oversold) | %K > 80 (overbought) |
| OBV | OBV | 1.0 | 10-bar slope positive | 10-bar slope negative |
| VWAP | VWAP | 1.2 | Close > VWAP | Close < VWAP |
| Divergence | RSI Div | 2.2 | Bullish divergence | Bearish divergence |

## Score Calculation

```
raw = weighted_sum(feature_values * weights) / sum(weights)
score = (raw + 2) / 4    # Normalize to 0..1
```

Features disabled in SignalConfig are excluded from both numerator and denominator.

## Labels

| Score Range | Label |
|-------------|-------|
| > 0.75 | STRONG BUY |
| > 0.58 | BUY |
| > 0.42 | NEUTRAL |
| > 0.25 | SELL |
| <= 0.25 | STRONG SELL |

## Signal Config

Users choose which features participate via:

- **Presets**: One-click groups (Trend, Reversal, Scalp, Volume, Momentum, Conservative, All)
- **Individual toggles**: Grouped by category (Trend, Momentum, Volume, Band/Reversal)
- **Persisted**: Saved to localStorage, survives page reload

## File

`plugins/btc-chart/lib/ml.ts`

```typescript
export function mlSignal(
  data, nwe, sma50, sma200, rsi, macd,
  extra?: { adx, stoch, obv, vwap, divs },
  enabledFeatures?: Record<string, boolean>,
): MLResult
```
