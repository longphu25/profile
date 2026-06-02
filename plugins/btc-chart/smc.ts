/**
 * Smart Money Concepts (SMC) overlay
 * Ported from LuxAlgo Pine — swing structure, order blocks, FVG
 */

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ── Types ──────────────────────────────────────────────────────────────
export interface SMCConfig {
  structure: boolean // BOS/CHoCH lines
  orderBlocks: boolean // OB boxes
  fvg: boolean // Fair Value Gaps
  swingLen: number // default 50
  internalLen: number // default 5
}

export interface StructureLine {
  time: number
  price: number
  endTime: number
  type: 'BOS' | 'CHoCH'
  bias: 'bull' | 'bear'
}

export interface OrderBlock {
  startTime: number
  high: number
  low: number
  bias: 'bull' | 'bear'
  broken: boolean
}

export interface FVGBox {
  time: number
  top: number
  bottom: number
  bias: 'bull' | 'bear'
}

export interface SMCResult {
  structures: StructureLine[]
  orderBlocks: OrderBlock[]
  fvgs: FVGBox[]
}

// ── Helpers ────────────────────────────────────────────────────────────
interface Pivot {
  price: number
  time: number
  idx: number
  crossed: boolean
}

function detectPivots(candles: Candle[], len: number) {
  const highs: Pivot[] = []
  const lows: Pivot[] = []
  for (let i = len; i < candles.length - len; i++) {
    let isHigh = true
    let isLow = true
    for (let j = 1; j <= len; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high)
        isHigh = false
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low)
        isLow = false
    }
    if (isHigh)
      highs.push({ price: candles[i].high, time: candles[i].time, idx: i, crossed: false })
    if (isLow) lows.push({ price: candles[i].low, time: candles[i].time, idx: i, crossed: false })
  }
  return { highs, lows }
}

// ── Main Computation ───────────────────────────────────────────────────
export function computeSMC(candles: Candle[], cfg: SMCConfig): SMCResult {
  const structures: StructureLine[] = []
  const orderBlocks: OrderBlock[] = []
  const fvgs: FVGBox[] = []

  if (candles.length < cfg.swingLen * 2 + 1) return { structures, orderBlocks, fvgs }

  // ── Structure ──
  if (cfg.structure || cfg.orderBlocks) {
    const { highs, lows } = detectPivots(candles, cfg.swingLen)

    const pivotHighMap = new Map<number, Pivot>()
    const pivotLowMap = new Map<number, Pivot>()
    for (const h of highs) pivotHighMap.set(h.idx, h)
    for (const l of lows) pivotLowMap.set(l.idx, l)

    let swHigh: Pivot | null = null
    let swLow: Pivot | null = null
    let currentBias: 'bull' | 'bear' = 'bull'

    for (let i = cfg.swingLen; i < candles.length; i++) {
      const ph = pivotHighMap.get(i)
      const pl = pivotLowMap.get(i)
      if (ph) swHigh = { ...ph, crossed: false }
      if (pl) swLow = { ...pl, crossed: false }

      // Bullish break: close > swHigh
      if (swHigh && !swHigh.crossed && candles[i].close > swHigh.price) {
        const type = currentBias === 'bear' ? 'CHoCH' : 'BOS'
        structures.push({
          time: swHigh.time,
          price: swHigh.price,
          endTime: candles[i].time,
          type,
          bias: 'bull',
        })
        swHigh.crossed = true
        // Store OB (last bearish candle before break)
        if (cfg.orderBlocks) {
          for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
            if (candles[j].close < candles[j].open) {
              orderBlocks.push({
                startTime: candles[j].time,
                high: candles[j].high,
                low: candles[j].low,
                bias: 'bull',
                broken: false,
              })
              break
            }
          }
        }
        currentBias = 'bull'
      }

      // Bearish break: close < swLow
      if (swLow && !swLow.crossed && candles[i].close < swLow.price) {
        const type = currentBias === 'bull' ? 'CHoCH' : 'BOS'
        structures.push({
          time: swLow.time,
          price: swLow.price,
          endTime: candles[i].time,
          type,
          bias: 'bear',
        })
        swLow.crossed = true
        if (cfg.orderBlocks) {
          for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
            if (candles[j].close > candles[j].open) {
              orderBlocks.push({
                startTime: candles[j].time,
                high: candles[j].high,
                low: candles[j].low,
                bias: 'bear',
                broken: false,
              })
              break
            }
          }
        }
        currentBias = 'bear'
      }
    }

    // Mark broken OBs
    for (const ob of orderBlocks) {
      for (let i = 0; i < candles.length; i++) {
        if (candles[i].time <= ob.startTime) continue
        if (ob.bias === 'bull' && candles[i].low < ob.low) {
          ob.broken = true
          break
        }
        if (ob.bias === 'bear' && candles[i].high > ob.high) {
          ob.broken = true
          break
        }
      }
    }
  }

  // ── FVG ──
  if (cfg.fvg) {
    for (let i = 2; i < candles.length; i++) {
      // Bullish FVG: current low > 2-bars-ago high
      if (candles[i].low > candles[i - 2].high) {
        fvgs.push({
          time: candles[i - 1].time,
          top: candles[i].low,
          bottom: candles[i - 2].high,
          bias: 'bull',
        })
      }
      // Bearish FVG: current high < 2-bars-ago low
      if (candles[i].high < candles[i - 2].low) {
        fvgs.push({
          time: candles[i - 1].time,
          top: candles[i - 2].low,
          bottom: candles[i].high,
          bias: 'bear',
        })
      }
    }
    // Remove filled FVGs
    for (const fvg of fvgs) {
      for (let i = 0; i < candles.length; i++) {
        if (candles[i].time <= fvg.time) continue
        if (fvg.bias === 'bull' && candles[i].low <= fvg.bottom) {
          fvg.bottom = fvg.top
          break
        } // mark as filled
        if (fvg.bias === 'bear' && candles[i].high >= fvg.top) {
          fvg.top = fvg.bottom
          break
        }
      }
    }
  }

  return {
    structures,
    orderBlocks: orderBlocks.filter((ob) => !ob.broken).slice(-10),
    fvgs: fvgs.filter((f) => f.top !== f.bottom).slice(-15),
  }
}
