// BTC Chart — Kathy Lien High-Probability Reversal System
// Implements: Double Bollinger Bands (DBB), zone-based reversal detection,
// Bollinger squeeze, momentum exhaustion, and trend-vs-range classification.

import type { Candle } from './types'

/** Double Bollinger Band values at a single bar. */
export interface DBBValues {
  sma: number
  upper2: number // +2 SD
  lower2: number // -2 SD
  upper1: number // +1 SD
  lower1: number // -1 SD
  bandwidth: number // (upper2 - lower2) / sma
}

/** Zone classification per Kathy Lien's DBB rules. */
export type DBBZone = 'buy' | 'sell' | 'neutral'

/** A detected reversal signal. */
export interface LienReversal {
  time: number
  type: 'bullish' | 'bearish'
  /** Price at signal */
  price: number
  /** Zone transition that triggered it */
  from: DBBZone
  to: DBBZone
  /** Confidence (0-100): higher when confirmed by momentum + squeeze release */
  confidence: number
  reasons: string[]
}

/** Bollinger Squeeze state. */
export interface SqueezeState {
  active: boolean
  /** How many bars the squeeze has lasted */
  bars: number
  /** Direction of breakout if squeeze just released */
  breakout: 'up' | 'down' | null
}

/** Complete Kathy Lien reversal analysis result. */
export interface LienResult {
  /** Current DBB values */
  dbb: DBBValues | null
  /** Current zone */
  zone: DBBZone
  /** Previous zone (for transition detection) */
  prevZone: DBBZone
  /** Market regime */
  regime: 'trending_up' | 'trending_down' | 'range'
  /** Active squeeze state */
  squeeze: SqueezeState
  /** Detected reversal signals (last N) */
  reversals: LienReversal[]
  /** Latest signal (if any, within last 5 bars) */
  latestSignal: LienReversal | null
  /** Momentum exhaustion detected */
  exhaustion: boolean
  /** Band touch (price at outer band) */
  bandTouch: 'upper' | 'lower' | null
  /** ADR% spent (how much of average daily range is already used) */
  adrSpent: number
}

/** Compute Bollinger Band values for all bars. */
function computeDBB(data: Candle[], period = 20): (DBBValues | null)[] {
  const n = data.length
  const out: (DBBValues | null)[] = new Array(n).fill(null)
  for (let i = period - 1; i < n; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close
    const sma = sum / period
    let variance = 0
    for (let j = i - period + 1; j <= i; j++) variance += (data[j].close - sma) ** 2
    const sd = Math.sqrt(variance / period)
    out[i] = {
      sma,
      upper2: sma + 2 * sd,
      lower2: sma - 2 * sd,
      upper1: sma + sd,
      lower1: sma - sd,
      bandwidth: sma > 0 ? ((sma + 2 * sd - (sma - 2 * sd)) / sma) * 100 : 0,
    }
  }
  return out
}

/** Classify which DBB zone a price is in. */
function classifyZone(price: number, dbb: DBBValues): DBBZone {
  if (price >= dbb.upper1) return 'buy'
  if (price <= dbb.lower1) return 'sell'
  return 'neutral'
}

/** Detect Bollinger Squeeze (bandwidth contraction). */
function detectSqueeze(dbbArr: (DBBValues | null)[], data: Candle[], lookback = 120): SqueezeState {
  const n = dbbArr.length
  const curr = dbbArr[n - 1]
  if (!curr) return { active: false, bars: 0, breakout: null }

  // Find the average bandwidth over lookback
  let bwSum = 0,
    bwCount = 0
  const start = Math.max(0, n - lookback)
  for (let i = start; i < n; i++) {
    if (dbbArr[i]) {
      bwSum += dbbArr[i]!.bandwidth
      bwCount++
    }
  }
  if (!bwCount) return { active: false, bars: 0, breakout: null }
  const avgBw = bwSum / bwCount
  const squeezeThr = avgBw * 0.5 // Squeeze when BW < 50% of average

  const active = curr.bandwidth < squeezeThr
  let bars = 0
  if (active) {
    for (let i = n - 1; i >= start; i--) {
      if (dbbArr[i] && dbbArr[i]!.bandwidth < squeezeThr) bars++
      else break
    }
  }

  // Check if squeeze just released (was active prev bar, not now)
  let breakout: 'up' | 'down' | null = null
  if (!active && n >= 2 && dbbArr[n - 2]) {
    const prevBw = dbbArr[n - 2]!.bandwidth
    if (prevBw < squeezeThr) {
      breakout = data[n - 1].close > curr.sma ? 'up' : 'down'
    }
  }

  return { active, bars, breakout }
}

/** Detect momentum exhaustion (consecutive candles failing to expand). */
function detectExhaustion(data: Candle[], dbbArr: (DBBValues | null)[]): boolean {
  const n = data.length
  if (n < 5) return false
  const curr = dbbArr[n - 1]
  if (!curr) return false

  // Exhaustion: price touched outer band but last 3 bars show decreasing range
  const touchedUpper =
    data[n - 1].high >= curr.upper2 || data[n - 2]?.high >= (dbbArr[n - 2]?.upper2 ?? Infinity)
  const touchedLower =
    data[n - 1].low <= curr.lower2 || data[n - 2]?.low <= (dbbArr[n - 2]?.lower2 ?? -Infinity)

  if (!touchedUpper && !touchedLower) return false

  // Check decreasing body size (momentum fading)
  let shrinking = 0
  for (let i = n - 3; i < n - 1; i++) {
    const bodyPrev = Math.abs(data[i].close - data[i].open)
    const bodyNext = Math.abs(data[i + 1].close - data[i + 1].open)
    if (bodyNext < bodyPrev) shrinking++
  }
  return shrinking >= 2
}

/**
 * Run the full Kathy Lien reversal analysis.
 */
export function computeLienReversal(data: Candle[]): LienResult {
  const empty: LienResult = {
    dbb: null,
    zone: 'neutral',
    prevZone: 'neutral',
    regime: 'range',
    squeeze: { active: false, bars: 0, breakout: null },
    reversals: [],
    latestSignal: null,
    exhaustion: false,
    bandTouch: null,
    adrSpent: 0,
  }
  if (data.length < 25) return empty

  const dbbArr = computeDBB(data, 20)
  const n = data.length
  const curr = dbbArr[n - 1]
  if (!curr) return empty

  const price = data[n - 1].close
  const zone = classifyZone(price, curr)
  const prevZone = dbbArr[n - 2] ? classifyZone(data[n - 2].close, dbbArr[n - 2]!) : 'neutral'

  // Regime: trending if price stayed in buy/sell zone for 5+ bars
  let regime: 'trending_up' | 'trending_down' | 'range' = 'range'
  let buyCount = 0,
    sellCount = 0
  for (let i = Math.max(0, n - 8); i < n; i++) {
    if (dbbArr[i]) {
      const z = classifyZone(data[i].close, dbbArr[i]!)
      if (z === 'buy') buyCount++
      else if (z === 'sell') sellCount++
    }
  }
  if (buyCount >= 5) regime = 'trending_up'
  else if (sellCount >= 5) regime = 'trending_down'

  // Squeeze
  const squeeze = detectSqueeze(dbbArr, data)

  // Exhaustion
  const exhaustion = detectExhaustion(data, dbbArr)

  // Band touch
  let bandTouch: 'upper' | 'lower' | null = null
  if (data[n - 1].high >= curr.upper2) bandTouch = 'upper'
  else if (data[n - 1].low <= curr.lower2) bandTouch = 'lower'

  // ADR spent: how much of the average daily range is already consumed
  let adrSpent = 0
  if (data.length >= 14) {
    let adrSum = 0
    for (let i = n - 14; i < n; i++) adrSum += data[i].high - data[i].low
    const adr = adrSum / 14
    const todayRange = data[n - 1].high - data[n - 1].low
    adrSpent = adr > 0 ? Math.min(100, (todayRange / adr) * 100) : 0
  }

  // Detect reversals: zone transitions in the last 30 bars
  const reversals: LienReversal[] = []
  for (let i = Math.max(21, n - 30); i < n; i++) {
    const dbbI = dbbArr[i]
    const dbbP = dbbArr[i - 1]
    if (!dbbI || !dbbP) continue

    const zI = classifyZone(data[i].close, dbbI)
    const zP = classifyZone(data[i - 1].close, dbbP)

    if (zI === zP) continue

    // Bullish reversal: sell -> neutral (or sell -> buy)
    if (zP === 'sell' && (zI === 'neutral' || zI === 'buy')) {
      const reasons: string[] = ['Price left sell zone']
      let conf = 40

      // Was there a lower band touch recently?
      for (let j = Math.max(0, i - 3); j <= i; j++) {
        if (dbbArr[j] && data[j].low <= dbbArr[j]!.lower2) {
          reasons.push('Lower band touch')
          conf += 20
          break
        }
      }
      // Candlestick confirmation: bullish engulfing or hammer
      if (data[i].close > data[i].open && data[i].close > data[i - 1].close) {
        reasons.push('Bullish candle')
        conf += 15
      }
      // Squeeze release up
      if (squeeze.breakout === 'up') {
        reasons.push('Squeeze breakout up')
        conf += 15
      }
      // RSI-like momentum (simple: 3-bar momentum positive)
      if (i >= 3 && data[i].close > data[i - 3].close) {
        reasons.push('Momentum shift')
        conf += 10
      }

      reversals.push({
        time: data[i].time,
        type: 'bullish',
        price: data[i].close,
        from: 'sell',
        to: zI,
        confidence: Math.min(100, conf),
        reasons,
      })
    }

    // Bearish reversal: buy -> neutral (or buy -> sell)
    if (zP === 'buy' && (zI === 'neutral' || zI === 'sell')) {
      const reasons: string[] = ['Price left buy zone']
      let conf = 40

      for (let j = Math.max(0, i - 3); j <= i; j++) {
        if (dbbArr[j] && data[j].high >= dbbArr[j]!.upper2) {
          reasons.push('Upper band touch')
          conf += 20
          break
        }
      }
      if (data[i].close < data[i].open && data[i].close < data[i - 1].close) {
        reasons.push('Bearish candle')
        conf += 15
      }
      if (squeeze.breakout === 'down') {
        reasons.push('Squeeze breakout down')
        conf += 15
      }
      if (i >= 3 && data[i].close < data[i - 3].close) {
        reasons.push('Momentum shift')
        conf += 10
      }

      reversals.push({
        time: data[i].time,
        type: 'bearish',
        price: data[i].close,
        from: 'buy',
        to: zI,
        confidence: Math.min(100, conf),
        reasons,
      })
    }
  }

  // Latest signal (within last 5 bars)
  const recent = reversals.filter((r) => r.time >= data[Math.max(0, n - 5)].time)
  const latestSignal = recent[recent.length - 1] ?? null

  return {
    dbb: curr,
    zone,
    prevZone,
    regime,
    squeeze,
    reversals: reversals.slice(-8),
    latestSignal,
    exhaustion,
    bandTouch,
    adrSpent,
  }
}
