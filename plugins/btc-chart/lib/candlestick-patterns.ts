// BTC Chart — Candlestick pattern detection (Japanese reversal patterns).

import type { Candle } from './types'

/** A detected candlestick pattern signal. */
export interface CandlePattern {
  time: number
  type: 'bullish' | 'bearish'
  name: string
  /** Bar index in the source data array */
  index: number
  price: number
}

/** Check if a candle is a Doji (body < threshold% of range). */
function isDoji(c: Candle, threshold = 0.1): boolean {
  const range = c.high - c.low
  if (range === 0) return true
  return Math.abs(c.close - c.open) <= range * threshold
}

/**
 * Bullish Harami Cross: large bearish candle followed by a Doji
 * whose body is contained within the prior candle's body.
 */
function isBullishHaramiCross(prev: Candle, curr: Candle): boolean {
  // Prev must be bearish with significant body
  const prevBody = Math.abs(prev.close - prev.open)
  const prevRange = prev.high - prev.low
  if (prev.close >= prev.open || prevRange === 0 || prevBody < prevRange * 0.4) return false

  // Current must be Doji
  if (!isDoji(curr)) return false

  // Doji body within prev body
  const prevTop = prev.open // bearish: open > close
  const prevBot = prev.close
  const currMid = (curr.open + curr.close) / 2
  return currMid >= prevBot && currMid <= prevTop
}

/**
 * Scan candle data and return all Bullish Harami Cross occurrences.
 */
export function detectCandlePatterns(data: Candle[], maxBars = 100): CandlePattern[] {
  const out: CandlePattern[] = []
  const start = Math.max(1, data.length - maxBars)
  for (let i = start; i < data.length; i++) {
    if (isBullishHaramiCross(data[i - 1], data[i])) {
      out.push({
        time: data[i].time,
        type: 'bullish',
        name: 'Harami Cross',
        index: i,
        price: data[i].low,
      })
    }
  }
  return out
}

/**
 * Quick check at a single bar index (for use in lien-reversal confirmation).
 */
export function hasBullishHaramiCross(data: Candle[], i: number): boolean {
  if (i < 1) return false
  return isBullishHaramiCross(data[i - 1], data[i])
}
