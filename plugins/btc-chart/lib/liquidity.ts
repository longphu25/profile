// BTC Chart — ICT "Liquidity Hacks": trading range, external/internal
// liquidity, dynamic FVG / inverse-FVG, and liquidity sweeps.
//
// Pure logic, no side-effects. Reads Smart-Money liquidity flow the way ICT
// traders do: find the higher-timeframe trading range and its equilibrium
// (premium/discount), classify liquidity pools as external (outside the range,
// where the crowd's stops sit — the real target) vs internal (FVGs/minor
// swings inside, the "fuel"), track FVGs that flip into inverse-FVGs, and flag
// liquidity sweeps (a level pierced then rejected back inside the range —
// highest-probability inside the London/NY killzones).

import type { Candle } from './types'
import type { Interval } from './constants'
import type { SMCResult } from '../smc-wasm'

/** The active trading range (from the higher timeframe when available). */
export interface TradingRange {
  high: number
  low: number
  /** 50% of the range — the premium/discount pivot. */
  equilibrium: number
  startTime: number
  /** True when a Break of Structure confirms the range is in play. */
  hasBOS: boolean
  bosBias: 'bull' | 'bear' | null
}

export type LiqSide = 'external' | 'internal'
export type PriceZone = 'premium' | 'discount' | 'equilibrium'

/** A pool of resting liquidity (a level the market may reach for). */
export interface LiquidityLevel {
  price: number
  time: number
  kind: 'swing-high' | 'swing-low' | 'fvg'
  side: LiqSide
  zone: PriceZone
  swept: boolean
}

/** A Fair Value Gap that price closed through, flipping its bias. */
export interface InverseFVG {
  time: number
  top: number
  bottom: number
  originalBias: 'bull' | 'bear'
  flippedBias: 'bull' | 'bear'
}

/** A sweep of an external liquidity level with rejection back into the range. */
export interface LiquiditySweep {
  time: number
  index: number
  /** The level that was swept. */
  level: number
  side: 'high' | 'low'
  /** 'bullish' = swept the low then reversed up; 'bearish' = swept high, down. */
  type: 'bullish' | 'bearish'
  /** True when the sweep bar fell inside a London/NY killzone. */
  inKillzone: boolean
  confidence: number
}

/** Where the market is most likely reaching next (the liquidity draw). */
export interface LiquidityTarget {
  price: number
  side: LiqSide
  label: string
}

export interface LiquidityResult {
  range: TradingRange | null
  levels: LiquidityLevel[]
  inverseFvgs: InverseFVG[]
  sweeps: LiquiditySweep[]
  nextTarget: LiquidityTarget | null
}

const EMPTY_RESULT: LiquidityResult = {
  range: null,
  levels: [],
  inverseFvgs: [],
  sweeps: [],
  nextTarget: null,
}

/** Higher-timeframe mapping for Hack #1 ("zoom out one level"). */
export const HTF_MAP: Record<Interval, Interval | null> = {
  '1m': '15m',
  '5m': '1h',
  '15m': '1h',
  '1h': '4h',
  '4h': '1d',
  '1d': null,
}

const DAY_SECONDS = 86400
const HOUR_SECONDS = 3600

/** London killzone [7,10) + NY killzone [12,15) in UTC hours. */
function inKillzone(time: number): boolean {
  const hour = Math.floor((((time % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS) / HOUR_SECONDS)
  return (hour >= 7 && hour < 10) || (hour >= 12 && hour < 15)
}

/** Classify a price against the range into premium / discount / equilibrium. */
function zoneOf(price: number, range: TradingRange): PriceZone {
  const span = range.high - range.low
  if (span <= 0) return 'equilibrium'
  const eqBand = span * 0.05 // ±5% around the midpoint counts as equilibrium
  if (Math.abs(price - range.equilibrium) <= eqBand) return 'equilibrium'
  return price > range.equilibrium ? 'premium' : 'discount'
}

/** Detect simple swing pivots (fractal high/low over ±`len` bars). */
function detectPivots(
  data: Candle[],
  len: number,
): { highs: { price: number; time: number }[]; lows: { price: number; time: number }[] } {
  const highs: { price: number; time: number }[] = []
  const lows: { price: number; time: number }[] = []
  for (let i = len; i < data.length - len; i++) {
    let isHigh = true
    let isLow = true
    for (let j = i - len; j <= i + len; j++) {
      if (j === i) continue
      if (data[j].high >= data[i].high) isHigh = false
      if (data[j].low <= data[i].low) isLow = false
    }
    if (isHigh) highs.push({ price: data[i].high, time: data[i].time })
    if (isLow) lows.push({ price: data[i].low, time: data[i].time })
  }
  return { highs, lows }
}

/**
 * Decode the liquidity landscape from candle data. Uses the higher timeframe
 * (when provided) to anchor the trading range, and the SMC result for FVGs +
 * BOS confirmation. Returns an empty result on too-short data.
 */
export function computeLiquidity(
  data: Candle[],
  htf: Candle[] | null,
  smc: SMCResult,
  _interval: Interval,
): LiquidityResult {
  if (data.length < 20) return EMPTY_RESULT

  // ── Hack #1: Trading range from the higher timeframe (fallback: current) ──
  // Use the last ~40 HTF bars (or 60 current bars) to bound the active range.
  const rangeSrc = htf && htf.length >= 10 ? htf.slice(-40) : data.slice(-60)
  let hi = -Infinity
  let lo = Infinity
  let startTime = rangeSrc[0].time
  for (const c of rangeSrc) {
    if (c.high > hi) hi = c.high
    if (c.low < lo) lo = c.low
  }
  const equilibrium = (hi + lo) / 2

  // BOS confirmation from SMC structures (most recent one).
  const lastBos = [...smc.structures].reverse().find((s) => s.type === 'BOS')
  const range: TradingRange = {
    high: hi,
    low: lo,
    equilibrium,
    startTime,
    hasBOS: !!lastBos,
    bosBias: lastBos ? lastBos.bias : null,
  }

  // ── Hack #2: External vs internal liquidity ──
  // Swing pivots on the current timeframe; extremes near the range edges are
  // external (the crowd's stops), everything inside is internal fuel.
  const { highs, lows } = detectPivots(data, 5)
  const eps = (hi - lo) * 0.02 // within 2% of a range edge = external
  const levels: LiquidityLevel[] = []
  for (const h of highs) {
    const side: LiqSide = Math.abs(h.price - hi) <= eps ? 'external' : 'internal'
    levels.push({
      price: h.price,
      time: h.time,
      kind: 'swing-high',
      side,
      zone: zoneOf(h.price, range),
      swept: false,
    })
  }
  for (const l of lows) {
    const side: LiqSide = Math.abs(l.price - lo) <= eps ? 'external' : 'internal'
    levels.push({
      price: l.price,
      time: l.time,
      kind: 'swing-low',
      side,
      zone: zoneOf(l.price, range),
      swept: false,
    })
  }
  // FVGs are always internal liquidity ("fuel" to reach the external pools).
  for (const f of smc.fvgs) {
    const mid = (f.top + f.bottom) / 2
    levels.push({
      price: mid,
      time: f.time,
      kind: 'fvg',
      side: 'internal',
      zone: zoneOf(mid, range),
      swept: false,
    })
  }

  // ── Hack #3: Dynamic liquidity — inverse FVGs ──
  // A bull FVG that price later closes below flips into a bearish IFVG (and
  // vice-versa). We check the candles after each gap for a decisive close.
  const inverseFvgs: InverseFVG[] = []
  for (const f of smc.fvgs) {
    // Find the first candle strictly after the gap time.
    const startIdx = data.findIndex((c) => c.time > f.time)
    if (startIdx < 0) continue
    for (let i = startIdx; i < data.length; i++) {
      const c = data[i]
      if (f.bias === 'bull' && c.close < f.bottom) {
        inverseFvgs.push({
          time: c.time,
          top: f.top,
          bottom: f.bottom,
          originalBias: 'bull',
          flippedBias: 'bear',
        })
        break
      }
      if (f.bias === 'bear' && c.close > f.top) {
        inverseFvgs.push({
          time: c.time,
          top: f.top,
          bottom: f.bottom,
          originalBias: 'bear',
          flippedBias: 'bull',
        })
        break
      }
    }
  }

  // ── Hack #4: Liquidity sweeps of the external range edges ──
  const sweeps: LiquiditySweep[] = []
  for (let i = 1; i < data.length; i++) {
    const c = data[i]
    const kz = inKillzone(c.time)
    // Bearish sweep: wick pierced the range high, closed back below it.
    if (c.high > hi && c.close < hi) {
      const wick = c.high - Math.max(c.close, c.open)
      const body = Math.abs(c.close - c.open) || 1e-9
      const confidence = Math.min(100, 50 + (kz ? 25 : 0) + Math.min(25, (wick / body) * 10))
      sweeps.push({
        time: c.time,
        index: i,
        level: hi,
        side: 'high',
        type: 'bearish',
        inKillzone: kz,
        confidence: Math.round(confidence),
      })
    } else if (c.low < lo && c.close > lo) {
      const wick = Math.min(c.close, c.open) - c.low
      const body = Math.abs(c.close - c.open) || 1e-9
      const confidence = Math.min(100, 50 + (kz ? 25 : 0) + Math.min(25, (wick / body) * 10))
      sweeps.push({
        time: c.time,
        index: i,
        level: lo,
        side: 'low',
        type: 'bullish',
        inKillzone: kz,
        confidence: Math.round(confidence),
      })
    }
  }
  // Mark the external levels that got swept.
  const lastSweep = sweeps[sweeps.length - 1]
  if (lastSweep) {
    for (const lv of levels) {
      if (lv.side !== 'external') continue
      if (lastSweep.side === 'high' && lv.kind === 'swing-high' && lv.price >= hi - eps) {
        lv.swept = true
      }
      if (lastSweep.side === 'low' && lv.kind === 'swing-low' && lv.price <= lo + eps) {
        lv.swept = true
      }
    }
  }

  // ── Next liquidity draw (the internal↔external loop) ──
  const price = data[data.length - 1].close
  let nextTarget: LiquidityTarget | null = null
  if (lastSweep && lastSweep.index >= data.length - 3) {
    // Just swept external → price should rotate toward the nearest internal FVG.
    const internalFvgs = levels
      .filter((l) => l.kind === 'fvg')
      .sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))
    const target = internalFvgs[0]
    if (target) {
      nextTarget = { price: target.price, side: 'internal', label: 'Internal FVG (fuel)' }
    }
  }
  if (!nextTarget) {
    // Otherwise the draw is the opposite external edge (undrawn liquidity).
    if (price < equilibrium) {
      nextTarget = { price: hi, side: 'external', label: 'External high (BSL)' }
    } else {
      nextTarget = { price: lo, side: 'external', label: 'External low (SSL)' }
    }
  }

  return { range, levels, inverseFvgs, sweeps, nextTarget }
}
