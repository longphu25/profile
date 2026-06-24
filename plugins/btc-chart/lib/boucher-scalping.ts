// BTC Chart — Jean-Francois Boucher M1 Scalping Engine
// Implements: ATR-based box framing, three-bar reversal triggers,
// ladder levels, sell-green/buy-red entries, and box-step tracking.

import type { Candle } from './types'

/** A single "box" representing one ATR-unit of price movement. */
export interface ScalpBox {
  high: number
  low: number
  startTime: number
  endTime: number
  /** Bars it took to traverse this box */
  bars: number
  /** Fast box (< median bars) implies momentum continuation */
  fast: boolean
}

/** Three-bar reversal signal at box edge. */
export interface ThreeBarSignal {
  time: number
  dir: 'long' | 'short'
  /** Price where bar 3 overtakes the apex/nadir */
  triggerPrice: number
  /** The box edge that generated this signal */
  edgePrice: number
}

/** Ladder level (support or resistance) spaced by box height. */
export interface LadderLevel {
  price: number
  role: 'support' | 'resistance'
  /** Number of touches */
  touches: number
}

/** Entry signal: sell green at resistance, buy red at support. */
export interface ScalpEntry {
  time: number
  dir: 'long' | 'short'
  price: number
  /** The ladder level that triggered the entry */
  level: number
  /** Whether a three-bar reversal confirmed it */
  confirmed: boolean
}

/** Complete scalping analysis result. */
export interface BoucherResult {
  /** Current ATR(14) on M1, used as box height */
  atr: number
  /** Box height (1x ATR) */
  boxSize: number
  /** Active box boundaries */
  currentBox: ScalpBox | null
  /** Historical boxes (last N) */
  boxes: ScalpBox[]
  /** Ladder levels */
  ladder: LadderLevel[]
  /** Three-bar reversal signals */
  threeBar: ThreeBarSignal[]
  /** Qualified scalp entries */
  entries: ScalpEntry[]
  /** Risk envelope (4 boxes from entry) */
  envelope: number
  /** Suggested TP (target ~1 ATR from entry) */
  target: number
  /** Speed reading: current box bars vs median */
  speed: 'fast' | 'normal' | 'slow'
  /** Session stats */
  stats: { signals: number; wins: number; rr: number }
}

/** Calculate ATR for M1 candles. */
function calcATR(data: Candle[], period = 14): number {
  if (data.length < period + 1) return 0
  let sum = 0
  const start = data.length - period
  for (let i = start; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    )
    sum += tr
  }
  return sum / period
}

/** Detect boxes by stepping through price in ATR-sized units. */
function detectBoxes(data: Candle[], boxSize: number): ScalpBox[] {
  if (data.length < 2 || boxSize <= 0) return []
  const boxes: ScalpBox[] = []
  let boxLow = data[0].low
  let boxHigh = boxLow + boxSize
  let startIdx = 0

  for (let i = 1; i < data.length; i++) {
    // Price breaks above box
    if (data[i].high > boxHigh) {
      boxes.push({
        high: boxHigh,
        low: boxLow,
        startTime: data[startIdx].time,
        endTime: data[i].time,
        bars: i - startIdx,
        fast: false, // computed later
      })
      boxLow = boxHigh
      boxHigh = boxLow + boxSize
      startIdx = i
    }
    // Price breaks below box
    else if (data[i].low < boxLow) {
      boxes.push({
        high: boxHigh,
        low: boxLow,
        startTime: data[startIdx].time,
        endTime: data[i].time,
        bars: i - startIdx,
        fast: false,
      })
      boxHigh = boxLow
      boxLow = boxHigh - boxSize
      startIdx = i
    }
  }

  // Mark fast boxes (bars < median)
  if (boxes.length > 2) {
    const sorted = boxes.map((b) => b.bars).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    for (const b of boxes) b.fast = b.bars < median
  }

  return boxes
}

/** Detect three-bar reversal patterns at box edges. */
function detectThreeBar(data: Candle[], _boxSize: number): ThreeBarSignal[] {
  const signals: ThreeBarSignal[] = []
  if (data.length < 4) return signals

  // Only check last 60 bars for performance
  const start = Math.max(3, data.length - 60)
  for (let i = start; i < data.length; i++) {
    const bar1 = data[i - 2]
    const _bar2 = data[i - 1]
    const bar3 = data[i]

    // LONG: bar1 bearish, bar2 neutral/small, bar3 bullish overtaking bar1's high (apex)
    const bar1Bear = bar1.close < bar1.open
    const bar3Bull = bar3.close > bar3.open
    if (bar1Bear && bar3Bull && bar3.close > bar1.high) {
      signals.push({
        time: bar3.time,
        dir: 'long',
        triggerPrice: bar3.close,
        edgePrice: bar1.low,
      })
    }

    // SHORT: bar1 bullish, bar2 neutral/small, bar3 bearish overtaking bar1's low (nadir)
    const bar1Bull = bar1.close > bar1.open
    const bar3Bear = bar3.close < bar3.open
    if (bar1Bull && bar3Bear && bar3.close < bar1.low) {
      signals.push({
        time: bar3.time,
        dir: 'short',
        triggerPrice: bar3.close,
        edgePrice: bar1.high,
      })
    }
  }

  return signals
}

/** Build ladder levels spaced by box size from recent swing high/low. */
function buildLadder(data: Candle[], boxSize: number, levels = 8): LadderLevel[] {
  if (data.length < 20 || boxSize <= 0) return []
  const recent = data.slice(-60)
  const high = Math.max(...recent.map((c) => c.high))
  const low = Math.min(...recent.map((c) => c.low))
  const mid = (high + low) / 2
  const price = data[data.length - 1].close

  const ladder: LadderLevel[] = []
  // Generate levels above and below current price
  for (let lvl = -levels; lvl <= levels; lvl++) {
    const p = Math.round((mid + lvl * boxSize) * 100) / 100
    if (p <= 0) continue
    // Count touches (price came within 0.2 box of this level)
    const threshold = boxSize * 0.2
    let touches = 0
    for (const c of recent) {
      if (Math.abs(c.high - p) < threshold || Math.abs(c.low - p) < threshold) touches++
    }
    ladder.push({
      price: p,
      role: p > price ? 'resistance' : 'support',
      touches,
    })
  }

  return ladder.filter((l) => l.touches > 0).sort((a, b) => b.price - a.price)
}

/** Detect scalp entries: sell green at resistance, buy red at support. */
function detectEntries(
  data: Candle[],
  ladder: LadderLevel[],
  threeBar: ThreeBarSignal[],
  boxSize: number,
): ScalpEntry[] {
  const entries: ScalpEntry[] = []
  if (data.length < 3) return entries

  const threshold = boxSize * 0.3
  // Check last 20 bars
  const start = Math.max(1, data.length - 20)
  for (let i = start; i < data.length; i++) {
    const c = data[i]
    const isGreen = c.close > c.open
    const isRed = c.close < c.open

    for (const lvl of ladder) {
      // Sell green at resistance
      if (isGreen && lvl.role === 'resistance' && Math.abs(c.high - lvl.price) < threshold) {
        const confirmed = threeBar.some((s) => s.time === c.time && s.dir === 'short')
        entries.push({
          time: c.time,
          dir: 'short',
          price: c.close,
          level: lvl.price,
          confirmed,
        })
        break
      }
      // Buy red at support
      if (isRed && lvl.role === 'support' && Math.abs(c.low - lvl.price) < threshold) {
        const confirmed = threeBar.some((s) => s.time === c.time && s.dir === 'long')
        entries.push({
          time: c.time,
          dir: 'long',
          price: c.close,
          level: lvl.price,
          confirmed,
        })
        break
      }
    }
  }

  return entries
}

/**
 * Run the full Boucher M1 scalping analysis on the given candle data.
 * Designed for 1m timeframe but works on any TF by adapting ATR.
 */
export function computeBoucherScalping(data: Candle[]): BoucherResult {
  const empty: BoucherResult = {
    atr: 0,
    boxSize: 0,
    currentBox: null,
    boxes: [],
    ladder: [],
    threeBar: [],
    entries: [],
    envelope: 0,
    target: 0,
    speed: 'normal',
    stats: { signals: 0, wins: 0, rr: 0 },
  }
  if (data.length < 20) return empty

  const atr = calcATR(data, 14)
  if (atr <= 0) return empty

  const boxSize = atr
  const boxes = detectBoxes(data, boxSize)
  const threeBar = detectThreeBar(data, boxSize)
  const ladder = buildLadder(data, boxSize)
  const entries = detectEntries(data, ladder, threeBar, boxSize)

  // Current box: from the last completed box edge
  const lastBox = boxes[boxes.length - 1] ?? null

  // Speed reading
  let speed: 'fast' | 'normal' | 'slow' = 'normal'
  if (boxes.length > 2) {
    const sorted = boxes.map((b) => b.bars).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    if (lastBox) {
      if (lastBox.bars < median * 0.6) speed = 'fast'
      else if (lastBox.bars > median * 1.5) speed = 'slow'
    }
  }

  // Envelope = 4 boxes, target = 1 ATR
  const envelope = boxSize * 4
  const target = boxSize

  // Simple win-rate estimation from recent entries
  let wins = 0
  for (const e of entries.slice(0, -1)) {
    // Check if price moved target in the right direction within next 5 bars
    const idx = data.findIndex((c) => c.time === e.time)
    if (idx < 0 || idx + 5 >= data.length) continue
    for (let j = idx + 1; j <= Math.min(idx + 5, data.length - 1); j++) {
      if (e.dir === 'long' && data[j].high >= e.price + target) {
        wins++
        break
      }
      if (e.dir === 'short' && data[j].low <= e.price - target) {
        wins++
        break
      }
    }
  }

  return {
    atr,
    boxSize,
    currentBox: lastBox,
    boxes: boxes.slice(-20),
    ladder,
    threeBar: threeBar.slice(-10),
    entries: entries.slice(-10),
    envelope,
    target,
    speed,
    stats: {
      signals: entries.length,
      wins,
      rr: entries.length > 0 ? wins / entries.length : 0,
    },
  }
}
