// BTC Chart — automatic Entry / SL / TP calculation from indicator confluence.

import type { Candle, NWE, MLResult, TradeSetup } from './types'

export type { TradeSetup }

/**
 * Compute a suggested trade setup based on confluence of:
 * ML signal, RSI, NWE zone, ADX trend strength.
 *
 * Returns null direction when no clear setup exists.
 */
export function calcTradeSetup(
  data: Candle[],
  nwe: NWE,
  rsi: (number | null)[],
  adx: { adx: (number | null)[] },
  ml: MLResult,
): TradeSetup {
  const i = data.length - 1
  const c = data[i]
  const price = c.close

  const rsiV = rsi[i]
  const adxV = adx.adx[i]
  const nweUp = nwe.upper[i]
  const nweLo = nwe.lower[i]
  const nweMid = nwe.mid[i]

  // Count bullish / bearish confluence signals
  let bull = 0
  let bear = 0
  const reasons: string[] = []

  // ML signal
  if (ml.score >= 0.65) {
    bull++
    reasons.push('ML Bullish')
  } else if (ml.score <= 0.35) {
    bear++
    reasons.push('ML Bearish')
  }

  // RSI
  if (rsiV != null && rsiV < 35) {
    bull++
    reasons.push(`RSI ${rsiV.toFixed(0)} (oversold)`)
  } else if (rsiV != null && rsiV > 65) {
    bear++
    reasons.push(`RSI ${rsiV.toFixed(0)} (overbought)`)
  }

  // NWE zone position
  if (nweLo != null && price <= nweLo * 1.005) {
    bull++
    reasons.push('Price at NWE lower')
  } else if (nweUp != null && price >= nweUp * 0.995) {
    bear++
    reasons.push('Price at NWE upper')
  }

  // ADX trend strength (confirms direction)
  if (adxV != null && adxV >= 25) {
    reasons.push(`ADX ${adxV.toFixed(0)} (trending)`)
  }

  // Swing high/low for SL (last 20 bars)
  const lookback = data.slice(Math.max(0, i - 20), i + 1)
  const swingLow = Math.min(...lookback.map((d) => d.low))
  const swingHigh = Math.max(...lookback.map((d) => d.high))

  // Determine direction: need at least 2 confluence signals
  let dir: 'long' | 'short' | null = null
  if (bull >= 2 && bull > bear) dir = 'long'
  else if (bear >= 2 && bear > bull) dir = 'short'

  const confidence = Math.min(100, Math.max(bull, bear) * 25)

  if (dir === 'long') {
    const entry = price
    const sl = Math.min(swingLow, nweLo ?? swingLow) * 0.998 // buffer 0.2%
    const risk = entry - sl
    const tp1 = entry + risk * 2
    const tp2 = nweUp != null ? Math.max(nweUp, entry + risk * 3) : entry + risk * 3
    return { dir, entry, sl, tp1, tp2, rr: 2, confidence, reasons }
  }
  if (dir === 'short') {
    const entry = price
    const sl = Math.max(swingHigh, nweUp ?? swingHigh) * 1.002
    const risk = sl - entry
    const tp1 = entry - risk * 2
    const tp2 = nweLo != null ? Math.min(nweLo, entry - risk * 3) : entry - risk * 3
    return { dir, entry, sl, tp1, tp2, rr: 2, confidence, reasons }
  }

  // No setup
  return {
    dir: null,
    entry: price,
    sl: price,
    tp1: price,
    tp2: price,
    rr: 0,
    confidence: 0,
    reasons: ['No confluence'],
  }
}

/** Compute SL/TP suggestions for an existing position based on NWE + ATR. */
export function suggestSlTp(
  pos: { side: 'long' | 'short'; entryPrice: number },
  data: Candle[],
  nwe: NWE,
): { sl: number; tp1: number; tp2: number } {
  const i = data.length - 1
  const nweUp = nwe.upper[i]
  const nweLo = nwe.lower[i]

  // ATR(14) for volatility-based stops
  let atrSum = 0
  const period = Math.min(14, data.length - 1)
  for (let j = data.length - period; j < data.length; j++) {
    const tr = Math.max(
      data[j].high - data[j].low,
      Math.abs(data[j].high - data[j - 1].close),
      Math.abs(data[j].low - data[j - 1].close),
    )
    atrSum += tr
  }
  const atr = atrSum / period

  if (pos.side === 'long') {
    const sl = Math.max(pos.entryPrice - atr * 1.5, nweLo ?? pos.entryPrice - atr * 1.5)
    const risk = pos.entryPrice - sl
    const tp1 = pos.entryPrice + risk * 2
    const tp2 = nweUp ?? pos.entryPrice + risk * 3
    return { sl, tp1, tp2 }
  }
  // short
  const sl = Math.min(pos.entryPrice + atr * 1.5, nweUp ?? pos.entryPrice + atr * 1.5)
  const risk = sl - pos.entryPrice
  const tp1 = pos.entryPrice - risk * 2
  const tp2 = nweLo ?? pos.entryPrice - risk * 3
  return { sl, tp1, tp2 }
}
