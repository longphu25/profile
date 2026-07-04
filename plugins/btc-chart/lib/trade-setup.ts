// BTC Chart — automatic Entry / SL / TP calculation from indicator confluence.

import type { Candle, NWE, MLResult, TradeSetup } from './types'
import { ML_HYSTERESIS_LONG, ML_HYSTERESIS_SHORT, buildTradeSetupBias } from './trade-setup-stable'
import type { BoucherResult } from './boucher-scalping'
import type { LienResult } from './lien-reversal'
import type { NadarayaWatsonResult } from './nadaraya-watson'
import type { ICTResult } from './ict-sessions'
import type { LiquidityResult } from './liquidity'
import type { SMCResult } from '../smc'
import {
  maContextBlockReason,
  maContextPassReason,
  passesMaContextFilter,
  type AdaptiveMaSnapshot,
} from './ma-adaptive'
import { collectSmcConfluenceVotes } from './smc-signals'
import { collectSupplyDemandVotes, type SupplyDemandResult } from './supply-demand'

export type { TradeSetup }

const OTE_RATIO = 0.618

/** Conservative R-multiples: closer targets, higher hit rate, lower give-back risk. */
export const TP_RR_LADDER = [1, 1.5, 2] as const

/** Max SL distance from entry (fraction of price). */
const MAX_RISK_PCT = 0.012

/** Max SL distance as ATR multiple. */
const MAX_RISK_ATR_MULT = 1.5

/** Wick buffer beyond the nearest structure (fraction). */
const SL_WICK_BUFFER = 0.001

/** Hard cap for TP3 extension past the 2R rung (R multiple). */
const MAX_TP3_RR = 2.5

/** Minimum spacing between adjacent TP prices (fraction of entry). */
const TP_MIN_GAP_FRAC = 1e-5

function minTpGap(entry: number, risk: number): number {
  return Math.max(risk * 0.15, entry * TP_MIN_GAP_FRAC)
}

export interface TpStructureHints {
  /** Lux mid: preferred TP1 for mean-reversion (long: above entry). */
  readonly luxMid?: number | null
  /** Lux opposite band: soft cap for TP2/TP3 (upper for long, lower for short). */
  readonly luxBand?: number | null
  /** Swing or legacy structure cap for TP3 (cannot exceed {@link MAX_TP3_RR}). */
  readonly extendHigh?: number | null
  readonly extendLow?: number | null
}

/** ATR(14) true range average at bar `i`. */
export function calcAtr(data: Candle[], i: number, period = 14): number {
  const start = Math.max(1, i - period + 1)
  let sum = 0
  let count = 0
  for (let j = start; j <= i; j++) {
    const tr = Math.max(
      data[j].high - data[j].low,
      Math.abs(data[j].high - data[j - 1].close),
      Math.abs(data[j].low - data[j - 1].close),
    )
    sum += tr
    count++
  }
  return count > 0 ? sum / count : 0
}

function maxRiskDistance(anchor: number, atr: number): number {
  return Math.min(anchor * MAX_RISK_PCT, atr > 0 ? atr * MAX_RISK_ATR_MULT : anchor * MAX_RISK_PCT)
}

/**
 * Long SL: nearest support below anchor, wick buffer, then cap width to max risk.
 * Uses the tightest valid structure (highest low), not the deepest swing.
 */
export function calcLongStopLoss(anchor: number, structureLows: number[], atr: number): number {
  const maxDist = maxRiskDistance(anchor, atr)
  const floor = anchor - maxDist
  const below = structureLows.filter((p) => Number.isFinite(p) && p < anchor)
  if (below.length === 0) return floor
  const tight = Math.max(...below) * (1 - SL_WICK_BUFFER)
  return Math.max(tight, floor)
}

/**
 * Short SL: nearest resistance above anchor, wick buffer, then cap width to max risk.
 */
export function calcShortStopLoss(anchor: number, structureHighs: number[], atr: number): number {
  const maxDist = maxRiskDistance(anchor, atr)
  const ceiling = anchor + maxDist
  const above = structureHighs.filter((p) => Number.isFinite(p) && p > anchor)
  if (above.length === 0) return ceiling
  const tight = Math.min(...above) * (1 + SL_WICK_BUFFER)
  return Math.min(tight, ceiling)
}

/** Clamp SL after supply/demand overrides so risk never exceeds the cap. */
function clampLongSl(entry: number, sl: number, atr: number): number {
  const maxDist = maxRiskDistance(entry, atr)
  return Math.max(sl, entry - maxDist)
}

function clampShortSl(entry: number, sl: number, atr: number): number {
  const maxDist = maxRiskDistance(entry, atr)
  return Math.min(sl, entry + maxDist)
}

/**
 * Build TP1/TP2/TP3 from conservative R rungs (1R / 1.5R / 2R).
 * Lux mid/band hints pull targets toward mean-reversion levels when in range.
 */
export function calcTpLadder(
  dir: 'long' | 'short',
  entry: number,
  risk: number,
  structure: TpStructureHints = {},
): { tp1: number; tp2: number; tp3: number } {
  const [rr1, rr2, rr3] = TP_RR_LADDER
  if (risk <= 0) {
    return { tp1: entry, tp2: entry, tp3: entry }
  }
  if (dir === 'long') {
    let tp1 = entry + risk * rr1
    const mid = structure.luxMid
    if (mid != null && mid > entry && mid <= entry + risk * (rr1 + 0.35)) {
      tp1 = mid
    }
    let tp2 = entry + risk * rr2
    const band = structure.luxBand
    if (band != null && band > entry && band < tp2) tp2 = band
    let tp3 = entry + risk * rr3
    const tp3Cap = entry + risk * MAX_TP3_RR
    const hi = structure.extendHigh
    if (band != null && band > tp2) tp3 = Math.min(Math.max(tp3, band), tp3Cap)
    else if (hi != null && hi > tp3) tp3 = Math.min(hi, tp3Cap)
    const rungs = separateTpRungs('long', entry, risk, tp1, tp2, tp3)
    return { tp1, tp2: rungs.tp2, tp3: rungs.tp3 }
  }
  let tp1 = entry - risk * rr1
  const mid = structure.luxMid
  if (mid != null && mid < entry && mid >= entry - risk * (rr1 + 0.35)) {
    tp1 = mid
  }
  let tp2 = entry - risk * rr2
  const band = structure.luxBand
  if (band != null && band < entry && band > tp2) tp2 = band
  let tp3 = entry - risk * rr3
  const tp3Cap = entry - risk * MAX_TP3_RR
  const lo = structure.extendLow
  if (band != null && band < tp2) tp3 = Math.max(Math.min(tp3, band), tp3Cap)
  else if (lo != null && lo < tp3) tp3 = Math.max(lo, tp3Cap)
  const rungs = separateTpRungs('short', entry, risk, tp1, tp2, tp3)
  return { tp1, tp2: rungs.tp2, tp3: rungs.tp3 }
}

/**
 * Ensure TP2 and TP3 stay strictly ordered and visually distinct on the chart.
 * Safety net when structure extension equals an earlier rung.
 */
export function separateTpRungs(
  dir: 'long' | 'short',
  entry: number,
  risk: number,
  tp1: number,
  tp2: number,
  tp3: number,
): { tp2: number; tp3: number } {
  const gap = minTpGap(entry, risk)
  if (dir === 'long') {
    let t2 = tp2
    let t3 = tp3
    if (t2 <= tp1) t2 = tp1 + gap
    if (t3 <= t2) t3 = t2 + gap
    return { tp2: t2, tp3: t3 }
  }
  let t2 = tp2
  let t3 = tp3
  if (t2 >= tp1) t2 = tp1 - gap
  if (t3 >= t2) t3 = t2 - gap
  return { tp2: t2, tp3: t3 }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

interface EntryCalcResult {
  entry: number
  method: string
}

/**
 * Derive a limit entry from structural levels (not the live close).
 * Long: median of support candidates between SL and spot.
 * Short: median of resistance candidates between spot and SL.
 */
function calcLimitEntry(
  dir: 'long' | 'short',
  spot: number,
  sl: number,
  candidates: number[],
): EntryCalcResult {
  if (dir === 'long') {
    const valid = candidates.filter((p) => Number.isFinite(p) && p > sl)
    const limitZone = valid.filter((p) => p <= spot)
    if (limitZone.length >= 2) {
      return { entry: median(limitZone)!, method: 'Structure confluence (limit)' }
    }
    if (limitZone.length === 1) {
      return { entry: limitZone[0], method: 'Structure level (limit)' }
    }
    const ote = sl + (spot - sl) * OTE_RATIO
    if (ote > sl && ote < spot) {
      return { entry: ote, method: 'OTE 61.8% pullback' }
    }
    return { entry: sl + (spot - sl) * 0.5, method: 'Mid SL–spot zone' }
  }

  const valid = candidates.filter((p) => Number.isFinite(p) && p < sl)
  const limitZone = valid.filter((p) => p >= spot)
  if (limitZone.length >= 2) {
    return { entry: median(limitZone)!, method: 'Structure confluence (limit)' }
  }
  if (limitZone.length === 1) {
    return { entry: limitZone[0], method: 'Structure level (limit)' }
  }
  const ote = sl - (sl - spot) * OTE_RATIO
  if (ote < sl && ote > spot) {
    return { entry: ote, method: 'OTE 61.8% pullback' }
  }
  return { entry: sl - (sl - spot) * 0.5, method: 'Mid spot–SL zone' }
}

/** Collect structural prices that can anchor a long limit entry. */
function collectLongEntryCandidates(
  i: number,
  spot: number,
  swingLow: number,
  swingHigh: number,
  nwe: NWE,
  extra?: TradeSetupExtra,
): number[] {
  const out: number[] = []
  const nweMid = nwe.mid[i]
  const nweLo = nwe.lower[i]
  if (nweMid != null) out.push(nweMid)
  if (nweLo != null) out.push(nweLo * 1.002)

  if (extra?.luxNwe) {
    const luxMid = extra.luxNwe.mid[i]
    const luxLo = extra.luxNwe.lower[i]
    if (luxMid != null) out.push(luxMid)
    if (luxLo != null) out.push(luxLo * 1.002)
  }

  if (extra?.supplyDemand) {
    const sd = extra.supplyDemand
    const touchEps = spot * 0.003
    if (sd.mtfLong?.confirmed) out.push(sd.mtfLong.entry)
    if (sd.longEntry != null && sd.longEntry < spot) out.push(sd.longEntry)
    if (sd.nearestDemand && spot >= sd.nearestDemand.bottom - touchEps) {
      out.push(sd.nearestDemand.top, sd.nearestDemand.mid)
    }
    if (sd.nearestHtfDemand && spot >= sd.nearestHtfDemand.bottom - touchEps) {
      out.push(sd.nearestHtfDemand.top, sd.nearestHtfDemand.mid)
    }
  }

  if (extra?.liquidity) {
    const liq = extra.liquidity
    if (liq.range) {
      out.push(liq.range.equilibrium)
      const span = liq.range.high - liq.range.low
      if (span > 0) out.push(liq.range.low + span * 0.382)
    }
    for (const lv of liq.levels) {
      if ((lv.kind === 'fvg' || lv.kind === 'swing-low') && lv.price < spot) {
        out.push(lv.price)
      }
    }
    const lastSweep = liq.sweeps.filter((s) => s.type === 'bullish').at(-1)
    if (lastSweep) out.push(lastSweep.level)
  }

  if (extra?.boucher) {
    for (const lv of extra.boucher.ladder) {
      if (lv.role === 'support' && lv.price < spot) out.push(lv.price)
    }
    const lastEntry = extra.boucher.entries.at(-1)
    if (lastEntry?.dir === 'long') {
      out.push(lastEntry.price, lastEntry.level)
    }
  }

  const range = swingHigh - swingLow
  if (range > 0) {
    out.push(swingLow + range * OTE_RATIO)
    out.push(swingLow + range * 0.705)
  }

  return out
}

/** Collect structural prices that can anchor a short limit entry. */
function collectShortEntryCandidates(
  i: number,
  spot: number,
  swingLow: number,
  swingHigh: number,
  nwe: NWE,
  extra?: TradeSetupExtra,
): number[] {
  const out: number[] = []
  const nweMid = nwe.mid[i]
  const nweUp = nwe.upper[i]
  if (nweMid != null) out.push(nweMid)
  if (nweUp != null) out.push(nweUp * 0.998)

  if (extra?.luxNwe) {
    const luxMid = extra.luxNwe.mid[i]
    const luxUp = extra.luxNwe.upper[i]
    if (luxMid != null) out.push(luxMid)
    if (luxUp != null) out.push(luxUp * 0.998)
  }

  if (extra?.supplyDemand) {
    const sd = extra.supplyDemand
    const touchEps = spot * 0.003
    if (sd.mtfShort?.confirmed) out.push(sd.mtfShort.entry)
    if (sd.shortEntry != null && sd.shortEntry > spot) out.push(sd.shortEntry)
    if (sd.nearestSupply && spot <= sd.nearestSupply.top + touchEps) {
      out.push(sd.nearestSupply.bottom, sd.nearestSupply.mid)
    }
    if (sd.nearestHtfSupply && spot <= sd.nearestHtfSupply.top + touchEps) {
      out.push(sd.nearestHtfSupply.bottom, sd.nearestHtfSupply.mid)
    }
  }

  if (extra?.liquidity) {
    const liq = extra.liquidity
    if (liq.range) {
      out.push(liq.range.equilibrium)
      const span = liq.range.high - liq.range.low
      if (span > 0) out.push(liq.range.high - span * 0.382)
    }
    for (const lv of liq.levels) {
      if ((lv.kind === 'fvg' || lv.kind === 'swing-high') && lv.price > spot) {
        out.push(lv.price)
      }
    }
    const lastSweep = liq.sweeps.filter((s) => s.type === 'bearish').at(-1)
    if (lastSweep) out.push(lastSweep.level)
  }

  if (extra?.boucher) {
    for (const lv of extra.boucher.ladder) {
      if (lv.role === 'resistance' && lv.price > spot) out.push(lv.price)
    }
    const lastEntry = extra.boucher.entries.at(-1)
    if (lastEntry?.dir === 'short') {
      out.push(lastEntry.price, lastEntry.level)
    }
  }

  const range = swingHigh - swingLow
  if (range > 0) {
    out.push(swingHigh - range * OTE_RATIO)
    out.push(swingHigh - range * 0.705)
  }

  return out
}

/** Extra signals from Boucher + Lien + Lux NWE + ICT + Liquidity + SMC + S/D for confluence. */
export interface TradeSetupExtra {
  boucher?: BoucherResult
  lien?: LienResult
  luxNwe?: NadarayaWatsonResult
  ict?: ICTResult
  liquidity?: LiquidityResult
  smc?: SMCResult
  supplyDemand?: SupplyDemandResult
  /** Interval-scaled fast/slow EMA snapshot for Lux + SMC context gate. */
  adaptiveMa?: AdaptiveMaSnapshot
}

/**
 * Compute a suggested trade setup based on confluence of:
 * ML signal, RSI, NWE zone, ADX trend strength,
 * Boucher M1 scalping signals, and Kathy Lien reversal signals.
 *
 * Returns null direction when no clear setup exists.
 */
export function calcTradeSetup(
  data: Candle[],
  nwe: NWE,
  rsi: (number | null)[],
  adx: { adx: (number | null)[] },
  ml: MLResult,
  extra?: TradeSetupExtra,
): TradeSetup {
  const i = data.length - 1
  const c = data[i]
  const price = c.close

  const rsiV = rsi[i]
  const adxV = adx.adx[i]
  const nweUp = nwe.upper[i]
  const nweLo = nwe.lower[i]

  // Count bullish / bearish confluence signals
  let bull = 0
  let bear = 0
  const reasons: string[] = []

  // ML signal (hysteresis: >0.62 bull, <0.38 bear, neutral band in between)
  if (ml.score > ML_HYSTERESIS_LONG) {
    bull++
    reasons.push('ML Bullish')
  } else if (ml.score < ML_HYSTERESIS_SHORT) {
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

  // ── Boucher M1 Scalping signals ──
  if (extra?.boucher) {
    const b = extra.boucher
    const lastEntry = b.entries[b.entries.length - 1]
    // Recent entry signal (within last 3 bars)
    if (lastEntry && lastEntry.time >= data[Math.max(0, i - 3)].time) {
      if (lastEntry.dir === 'long') {
        bull++
        reasons.push('Boucher Buy')
      } else {
        bear++
        reasons.push('Boucher Sell')
      }
    }
    // Three-bar reversal (within last 3 bars)
    const last3b = b.threeBar[b.threeBar.length - 1]
    if (last3b && last3b.time >= data[Math.max(0, i - 3)].time) {
      if (last3b.dir === 'long') {
        bull++
        reasons.push('3-Bar Reversal+')
      } else {
        bear++
        reasons.push('3-Bar Reversal-')
      }
    }
    // Speed: fast box = momentum continuation
    if (b.speed === 'fast' && lastEntry) {
      if (lastEntry.dir === 'long') bull++
      else bear++
      reasons.push('Box Speed Fast')
    }
  }

  // ── Kathy Lien Reversal signals ──
  if (extra?.lien) {
    const l = extra.lien
    // Recent reversal signal (within last 5 bars)
    if (l.latestSignal) {
      if (l.latestSignal.type === 'bullish') {
        bull++
        reasons.push('Lien Bullish Rev')
      } else {
        bear++
        reasons.push('Lien Bearish Rev')
      }
      // High confidence reversal adds extra weight
      if (l.latestSignal.confidence >= 70) {
        if (l.latestSignal.type === 'bullish') bull++
        else bear++
        reasons.push('Lien High Conf')
      }
    }
    // Squeeze breakout
    if (l.squeeze.breakout === 'up') {
      bull++
      reasons.push('Squeeze Breakout+')
    } else if (l.squeeze.breakout === 'down') {
      bear++
      reasons.push('Squeeze Breakout-')
    }
    // Momentum exhaustion at band edge = reversal signal
    if (l.exhaustion && l.bandTouch === 'upper') {
      bear++
      reasons.push('Exhaustion at Top')
    } else if (l.exhaustion && l.bandTouch === 'lower') {
      bull++
      reasons.push('Exhaustion at Bottom')
    }
  }

  // ── Lux NWE (Nadaraya-Watson Envelope) signals ──
  if (extra?.luxNwe) {
    const lnwe = extra.luxNwe
    // Recent crossover signal (within last 3 bars)
    const recentSigs = lnwe.signals.filter((s) => s.index >= Math.max(0, i - 3) && s.index <= i)
    const lastSig = recentSigs[recentSigs.length - 1]
    if (lastSig) {
      if (lastSig.type === 'buy') {
        bull++
        reasons.push('NWE Cross Buy')
      } else {
        bear++
        reasons.push('NWE Cross Sell')
      }
    }
    // Band position: price near Lux NWE bands confirms reversal zone
    const luxUp = lnwe.upper[i]
    const luxLo = lnwe.lower[i]
    const luxMid = lnwe.mid[i]
    if (luxLo != null && price <= luxLo * 1.003) {
      bull++
      reasons.push('Price at Lux NWE lower')
    } else if (luxUp != null && price >= luxUp * 0.997) {
      bear++
      reasons.push('Price at Lux NWE upper')
    }
    // Trend bias: price relative to Lux NWE mid
    if (luxMid != null) {
      if (price > luxMid * 1.002) {
        reasons.push('Above Lux NWE mid (bullish bias)')
      } else if (price < luxMid * 0.998) {
        reasons.push('Below Lux NWE mid (bearish bias)')
      }
    }
  }

  // ── ICT Judas Swing + Killzone signals ──
  if (extra?.ict) {
    const ict = extra.ict
    // Recent Judas swing (within last 3 bars) — a stop-hunt reversal.
    const recentJudas = ict.judas.filter((s) => s.index >= Math.max(0, i - 3) && s.index <= i)
    const lastJudas = recentJudas[recentJudas.length - 1]
    if (lastJudas) {
      if (lastJudas.type === 'bullish') {
        bull++
        reasons.push('Judas Swing Long (sweep Asia low)')
        if (lastJudas.volConfirm) {
          bull++
          reasons.push('VOL confirms sweep')
        }
      } else {
        bear++
        reasons.push('Judas Swing Short (sweep Asia high)')
        if (lastJudas.volConfirm) {
          bear++
          reasons.push('VOL confirms sweep')
        }
      }
    }
    // Trading inside an active killzone raises conviction (no direction change).
    const activeKz = ict.killzones.find((k) => k.active)
    if (activeKz) {
      reasons.push(`In ${activeKz.name === 'london' ? 'London' : 'NY'} Killzone`)
    }
    // Overextended day: warn when >85% of ADR is spent (mean-reversion risk).
    if (ict.adrPct > 85) {
      reasons.push(`ADR ${ict.adrPct.toFixed(0)}% spent (extended)`)
    }
  }

  // ── ICT Liquidity: external sweeps + premium/discount + draw target ──
  if (extra?.liquidity) {
    const liq = extra.liquidity
    // A liquidity sweep of an external edge within the last ~3 bars is the
    // strongest smart-money entry signal — strongest when inside a killzone.
    const recentSweep = liq.sweeps.filter((s) => s.index >= Math.max(0, i - 3) && s.index <= i)
    const lastSweep = recentSweep[recentSweep.length - 1]
    if (lastSweep) {
      if (lastSweep.type === 'bullish') {
        bull++
        reasons.push('Liquidity Sweep Long (external low)')
        if (lastSweep.inKillzone) {
          bull++
          reasons.push('Sweep in London/NY Killzone')
        }
      } else {
        bear++
        reasons.push('Liquidity Sweep Short (external high)')
        if (lastSweep.inKillzone) {
          bear++
          reasons.push('Sweep in London/NY Killzone')
        }
      }
    }
    // Premium/discount bias: buying discount, selling premium (ICT rule).
    if (liq.range) {
      const price = c.close
      const hasBullFvg = liq.levels.some((l) => l.kind === 'fvg' && l.price > price)
      const hasBearFvg = liq.levels.some((l) => l.kind === 'fvg' && l.price < price)
      if (price < liq.range.equilibrium && hasBullFvg) {
        bull++
        reasons.push('Discount + bullish FVG target')
      } else if (price > liq.range.equilibrium && hasBearFvg) {
        bear++
        reasons.push('Premium + bearish FVG target')
      }
    }
    // Directional draw (context, no vote): where liquidity is being pulled.
    if (liq.nextTarget) {
      reasons.push(`Draw → ${liq.nextTarget.label}`)
    }
  }

  // ── SMC: BOS/CHoCH, Order Block touch, CHoCH after sweep ──
  if (extra?.smc) {
    const smcVotes = collectSmcConfluenceVotes(data, extra.smc, extra.liquidity)
    bull += smcVotes.bull
    bear += smcVotes.bear
    reasons.push(...smcVotes.reasons)
  }

  // ── Supply & Demand: zone touch + liquidity grab (FX Tactix) ──
  if (extra?.supplyDemand) {
    const sdVotes = collectSupplyDemandVotes(data, extra.supplyDemand)
    bull += sdVotes.bull
    bear += sdVotes.bear
    reasons.push(...sdVotes.reasons)
  }

  // Swing high/low for SL (last 20 bars)
  const lookback = data.slice(Math.max(0, i - 20), i + 1)
  const swingLow = Math.min(...lookback.map((d) => d.low))
  const swingHigh = Math.max(...lookback.map((d) => d.high))

  // Volume confirmation: current bar vs 20-bar average
  let volSum = 0
  const volPeriod = Math.min(20, i)
  for (let j = i - volPeriod; j < i; j++) volSum += data[j].volume
  const volAvg = volPeriod > 0 ? volSum / volPeriod : 1
  const volRatio = volAvg > 0 ? c.volume / volAvg : 1

  // Determine direction: need at least 2 confluence signals
  let dir: 'long' | 'short' | null = null
  if (bull >= 2 && bull > bear) dir = 'long'
  else if (bear >= 2 && bear > bull) dir = 'short'

  const confidence = Math.min(100, Math.max(bull, bear) * 20 + Math.abs(bull - bear) * 10)
  const bias = buildTradeSetupBias(bull, bear, reasons, ml.score)
  const emptyPlan: Pick<TradeSetup, 'plan' | 'planStatus'> = {
    plan: null,
    planStatus: 'waiting',
  }

  const atr = calcAtr(data, i)

  const maSnap = extra?.adaptiveMa
  if (dir && maSnap?.fast != null) {
    if (passesMaContextFilter(dir, price, maSnap)) {
      reasons.push(maContextPassReason(dir, maSnap.fastPeriod))
    } else {
      reasons.push(maContextBlockReason(dir, maSnap.fastPeriod))
      dir = null
    }
  }

  if (dir === 'long') {
    const luxLo = extra?.luxNwe?.lower[i]
    const luxUp = extra?.luxNwe?.upper[i]
    const luxMid = extra?.luxNwe?.mid[i]
    const structureLows: number[] = [swingLow]
    if (nweLo != null) structureLows.push(nweLo)
    if (luxLo != null) structureLows.push(luxLo)
    let sl = calcLongStopLoss(price, structureLows, atr)
    const candidates = collectLongEntryCandidates(i, price, swingLow, swingHigh, nwe, extra)
    let { entry, method } = calcLimitEntry('long', price, sl, candidates)
    const sdLong = extra?.supplyDemand
    const sdEntry = sdLong?.longEntry
    const sdEntryOk =
      sdEntry != null &&
      sdEntry < price &&
      (sdLong?.mtfLong?.confirmed === true || sdEntry >= price * 0.97)
    if (sdEntryOk) {
      const sdSl = sdLong?.longSl
      if (sdSl != null && sdSl < sdEntry) sl = sdSl
      if (sdEntry > sl) {
        entry = sdEntry
        method = sdLong?.mtfLong?.confirmed
          ? `MTF Demand (${sdLong.htfInterval ?? 'HTF'}) + LTF grab`
          : 'Demand zone top + spread'
      }
    }
    sl = clampLongSl(entry, sl, atr)
    if (sl >= entry) sl = calcLongStopLoss(entry, structureLows, atr)
    const risk = entry - sl
    const extendHigh = Math.min(
      swingHigh * 0.998,
      luxUp ?? Number.POSITIVE_INFINITY,
      nweUp ?? Number.POSITIVE_INFINITY,
    )
    const { tp1, tp2, tp3 } = calcTpLadder('long', entry, risk, {
      luxMid,
      luxBand: luxUp ?? null,
      extendHigh: Number.isFinite(extendHigh) && extendHigh > entry ? extendHigh : null,
    })
    const rr = risk > 0 ? (tp1 - entry) / risk : TP_RR_LADDER[0]
    return {
      dir,
      entry,
      sl,
      tp1,
      tp2,
      tp3,
      rr,
      confidence,
      reasons,
      volRatio,
      spotPrice: price,
      entryMethod: method,
      bias,
      ...emptyPlan,
    }
  }
  if (dir === 'short') {
    const luxUp = extra?.luxNwe?.upper[i]
    const luxLo = extra?.luxNwe?.lower[i]
    const luxMid = extra?.luxNwe?.mid[i]
    const structureHighs: number[] = [swingHigh]
    if (nweUp != null) structureHighs.push(nweUp)
    if (luxUp != null) structureHighs.push(luxUp)
    let sl = calcShortStopLoss(price, structureHighs, atr)
    const candidates = collectShortEntryCandidates(i, price, swingLow, swingHigh, nwe, extra)
    let { entry, method } = calcLimitEntry('short', price, sl, candidates)
    const sdShort = extra?.supplyDemand
    const sdEntry = sdShort?.shortEntry
    const sdEntryOk =
      sdEntry != null &&
      sdEntry > price &&
      (sdShort?.mtfShort?.confirmed === true || sdEntry <= price * 1.03)
    if (sdEntryOk) {
      const sdSl = sdShort?.shortSl
      if (sdSl != null && sdSl > sdEntry) sl = sdSl
      if (sdEntry < sl) {
        entry = sdEntry
        method = sdShort?.mtfShort?.confirmed
          ? `MTF Supply (${sdShort.htfInterval ?? 'HTF'}) + LTF grab`
          : 'Supply zone bottom - spread'
      }
    }
    sl = clampShortSl(entry, sl, atr)
    if (sl <= entry) sl = calcShortStopLoss(entry, structureHighs, atr)
    const risk = sl - entry
    const extendLow = Math.max(
      swingLow * 1.002,
      luxLo ?? Number.NEGATIVE_INFINITY,
      nweLo ?? Number.NEGATIVE_INFINITY,
    )
    const { tp1, tp2, tp3 } = calcTpLadder('short', entry, risk, {
      luxMid,
      luxBand: luxLo ?? null,
      extendLow: Number.isFinite(extendLow) && extendLow < entry ? extendLow : null,
    })
    const rr = risk > 0 ? (entry - tp1) / risk : TP_RR_LADDER[0]
    return {
      dir,
      entry,
      sl,
      tp1,
      tp2,
      tp3,
      rr,
      confidence,
      reasons,
      volRatio,
      spotPrice: price,
      entryMethod: method,
      bias,
      ...emptyPlan,
    }
  }

  // No setup (bias may still lean from live votes; MA gate can block plan here)
  return {
    dir: null,
    entry: price,
    sl: price,
    tp1: price,
    tp2: price,
    tp3: price,
    rr: 0,
    confidence: bias.confidence,
    reasons: reasons.length > 0 ? reasons : ['No confluence'],
    volRatio,
    spotPrice: price,
    entryMethod: '',
    bias,
    ...emptyPlan,
  }
}

/** Compute SL/TP suggestions for an existing position (same risk model as Trade Setup). */
export function suggestSlTp(
  pos: { side: 'long' | 'short'; entryPrice: number },
  data: Candle[],
  nwe: NWE,
): { sl: number; tp1: number; tp2: number; tp3: number } {
  const i = data.length - 1
  const nweUp = nwe.upper[i]
  const nweLo = nwe.lower[i]
  const nweMid = nwe.mid[i]
  const atr = calcAtr(data, i)

  if (pos.side === 'long') {
    const lows: number[] = []
    if (nweLo != null) lows.push(nweLo)
    const sl = calcLongStopLoss(pos.entryPrice, lows, atr)
    const risk = pos.entryPrice - sl
    const { tp1, tp2, tp3 } = calcTpLadder('long', pos.entryPrice, risk, {
      luxMid: nweMid,
      luxBand: nweUp,
      extendHigh: nweUp != null && nweUp > pos.entryPrice ? nweUp : null,
    })
    return { sl, tp1, tp2, tp3 }
  }
  const highs: number[] = []
  if (nweUp != null) highs.push(nweUp)
  const sl = calcShortStopLoss(pos.entryPrice, highs, atr)
  const risk = sl - pos.entryPrice
  const { tp1, tp2, tp3 } = calcTpLadder('short', pos.entryPrice, risk, {
    luxMid: nweMid,
    luxBand: nweLo,
    extendLow: nweLo != null && nweLo < pos.entryPrice ? nweLo : null,
  })
  return { sl, tp1, tp2, tp3 }
}
