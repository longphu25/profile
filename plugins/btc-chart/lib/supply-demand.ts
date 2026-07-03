// BTC Chart — Supply & Demand zones (FX Tactix style).
//
// Detects impulsive moves (3+ large same-direction candles), marks the last
// opposite candle before the impulse as the base, and draws zones from body
// or full wick range when wicks dominate. Supports liquidity-grab confirmation,
// entry above demand + spread, and SL at the 50% zone midpoint.

import type { Interval } from './constants'
import type { Candle } from './types'

/** Confirmed HTF zone with optional LTF liquidity-grab confirmation. */
export interface MtfSetup {
  readonly dir: 'long' | 'short'
  readonly htfZone: SupplyDemandZone
  readonly ltfGrab: SupplyDemandGrab | null
  readonly entry: number
  readonly sl: number
  readonly confirmed: boolean
}

export type ZoneKind = 'demand' | 'supply'
export type ZoneTimeframe = 'ltf' | 'htf'

/** A demand (support) or supply (resistance) zone from an impulsive departure. */
export interface SupplyDemandZone {
  readonly kind: ZoneKind
  readonly top: number
  readonly bottom: number
  /** 50% of the zone (FX Tactix SL anchor). */
  readonly mid: number
  readonly startTime: number
  readonly endTime: number
  readonly startIndex: number
  readonly endIndex: number
  readonly impulseBars: number
  /** 0–100 score from impulse size vs recent median body. */
  readonly strength: number
  readonly active: boolean
  readonly tested: boolean
  readonly timeframe: ZoneTimeframe
  readonly intervalLabel?: string
}

/** Liquidity grab: pierce beyond zone edge then close back inside (stop hunt). */
export interface SupplyDemandGrab {
  readonly index: number
  readonly time: number
  readonly type: 'bullish' | 'bearish'
  readonly level: number
  readonly zone: SupplyDemandZone
  readonly confidence: number
}

export interface SupplyDemandConfig {
  /** Minimum consecutive impulsive candles (FX Tactix: 3). */
  readonly minImpulseBars?: number
  /** Body must exceed medianBody * this factor to count as impulsive. */
  readonly bodyMult?: number
  /** Wick larger than body * this factor → zone uses full high/low. */
  readonly wickMult?: number
  /** Spread added above demand / below supply for entry (fraction of price). */
  readonly spreadFrac?: number
  /** Max zones kept per side. */
  readonly maxZones?: number
  /** Higher-timeframe candles (zoom-out one level). */
  readonly htfData?: Candle[] | null
  readonly htfInterval?: Interval | null
  readonly ltfInterval?: Interval | null
}

export interface SupplyDemandResult {
  readonly zones: SupplyDemandZone[]
  readonly grabs: SupplyDemandGrab[]
  readonly nearestDemand: SupplyDemandZone | null
  readonly nearestSupply: SupplyDemandZone | null
  readonly htfInterval: string | null
  readonly nearestHtfDemand: SupplyDemandZone | null
  readonly nearestHtfSupply: SupplyDemandZone | null
  readonly mtfLong: MtfSetup | null
  readonly mtfShort: MtfSetup | null
  readonly longEntry: number | null
  readonly longSl: number | null
  readonly shortEntry: number | null
  readonly shortSl: number | null
}

type ResolvedSupplyDemandConfig = Required<
  Pick<SupplyDemandConfig, 'minImpulseBars' | 'bodyMult' | 'wickMult' | 'spreadFrac' | 'maxZones'>
>

const DEFAULT_CFG: ResolvedSupplyDemandConfig = {
  minImpulseBars: 3,
  bodyMult: 0.75,
  wickMult: 1.2,
  spreadFrac: 0.00015,
  maxZones: 12,
}

const EMPTY: SupplyDemandResult = {
  zones: [],
  grabs: [],
  nearestDemand: null,
  nearestSupply: null,
  htfInterval: null,
  nearestHtfDemand: null,
  nearestHtfSupply: null,
  mtfLong: null,
  mtfShort: null,
  longEntry: null,
  longSl: null,
  shortEntry: null,
  shortSl: null,
}

function isBull(c: Candle): boolean {
  return c.close > c.open
}

function isBear(c: Candle): boolean {
  return c.close < c.open
}

function bodyOf(c: Candle): number {
  return Math.abs(c.close - c.open)
}

function medianBody(data: Candle[], end: number, period = 20): number {
  const start = Math.max(0, end - period + 1)
  const bodies: number[] = []
  for (let i = start; i <= end; i++) {
    const b = bodyOf(data[i])
    if (b > 0) bodies.push(b)
  }
  if (bodies.length === 0) return 0
  bodies.sort((a, b) => a - b)
  const mid = Math.floor(bodies.length / 2)
  return bodies.length % 2 === 1 ? bodies[mid] : (bodies[mid - 1] + bodies[mid]) / 2
}

function zoneBoundsFromBase(c: Candle, wickMult: number): { top: number; bottom: number } {
  const bodyTop = Math.max(c.open, c.close)
  const bodyBot = Math.min(c.open, c.close)
  const body = bodyTop - bodyBot
  const upperWick = c.high - bodyTop
  const lowerWick = bodyBot - c.low
  const useWicks = body <= 0 || upperWick > body * wickMult || lowerWick > body * wickMult
  if (useWicks) return { top: c.high, bottom: c.low }
  return { top: bodyTop, bottom: bodyBot }
}

function findOppositeBase(data: Candle[], impulseStart: number, kind: ZoneKind): number | null {
  for (let i = impulseStart - 1; i >= Math.max(0, impulseStart - 5); i--) {
    if (kind === 'demand' && isBear(data[i])) return i
    if (kind === 'supply' && isBull(data[i])) return i
  }
  return impulseStart > 0 ? impulseStart - 1 : null
}

function countImpulseRun(
  data: Candle[],
  endIdx: number,
  dir: 'up' | 'down',
  minBars: number,
  bodyMult: number,
  median: number,
): { start: number; count: number } | null {
  if (median <= 0) return null
  let count = 0
  let i = endIdx
  while (i >= 0) {
    const c = data[i]
    const large = bodyOf(c) >= median * bodyMult
    const ok = dir === 'up' ? isBull(c) && large : isBear(c) && large
    if (!ok) break
    count++
    i--
  }
  if (count < minBars) return null
  return { start: endIdx - count + 1, count }
}

function markZoneTested(data: Candle[], zone: SupplyDemandZone, fromIndex: number): boolean {
  for (let i = fromIndex; i < data.length; i++) {
    const c = data[i]
    if (c.time <= zone.endTime) continue
    if (c.low <= zone.top && c.high >= zone.bottom) return true
  }
  return false
}

function isZoneActive(data: Candle[], zone: SupplyDemandZone, fromIndex: number): boolean {
  for (let i = fromIndex; i < data.length; i++) {
    const c = data[i]
    if (c.time <= zone.endTime) continue
    if (zone.kind === 'demand' && c.close < zone.bottom) return false
    if (zone.kind === 'supply' && c.close > zone.top) return false
  }
  return true
}

function detectZones(data: Candle[], cfg: ResolvedSupplyDemandConfig): SupplyDemandZone[] {
  if (data.length < cfg.minImpulseBars + 2) return []

  const zones: SupplyDemandZone[] = []
  const seen = new Set<string>()

  for (let endIdx = cfg.minImpulseBars; endIdx < data.length; endIdx++) {
    const med = medianBody(data, endIdx)
    const upRun = countImpulseRun(data, endIdx, 'up', cfg.minImpulseBars, cfg.bodyMult, med)
    const downRun = countImpulseRun(data, endIdx, 'down', cfg.minImpulseBars, cfg.bodyMult, med)

    const candidates: Array<{ kind: ZoneKind; start: number; count: number }> = []
    if (upRun) candidates.push({ kind: 'demand', start: upRun.start, count: upRun.count })
    if (downRun) candidates.push({ kind: 'supply', start: downRun.start, count: downRun.count })

    for (const cand of candidates) {
      const baseIdx = findOppositeBase(data, cand.start, cand.kind)
      if (baseIdx == null) continue

      const base = data[baseIdx]
      const { top, bottom } = zoneBoundsFromBase(base, cfg.wickMult)
      if (top <= bottom) continue

      const key = `${cand.kind}:${base.time}:${top.toFixed(8)}:${bottom.toFixed(8)}`
      if (seen.has(key)) continue
      seen.add(key)

      const impulseSlice = data.slice(cand.start, endIdx + 1)
      const impulseMove = Math.abs(
        impulseSlice[impulseSlice.length - 1].close - impulseSlice[0].open,
      )
      const strength = Math.min(100, Math.round((impulseMove / Math.max(med, 1e-12)) * 12))

      const draft: SupplyDemandZone = {
        kind: cand.kind,
        top,
        bottom,
        mid: (top + bottom) / 2,
        startTime: base.time,
        endTime: data[endIdx].time,
        startIndex: baseIdx,
        endIndex: endIdx,
        impulseBars: cand.count,
        strength,
        active: true,
        tested: false,
        timeframe: 'ltf',
      }

      const tested = markZoneTested(data, draft, draft.endIndex + 1)
      const active = isZoneActive(data, draft, draft.endIndex + 1)
      if (active) zones.push({ ...draft, tested, active })
    }
  }

  zones.sort((a, b) => b.endTime - a.endTime)
  return zones.slice(0, cfg.maxZones)
}

function detectGrabs(data: Candle[], zones: SupplyDemandZone[]): SupplyDemandGrab[] {
  const grabs: SupplyDemandGrab[] = []
  const lookback = 8
  const i = data.length - 1
  const from = Math.max(0, i - lookback)

  for (const zone of zones) {
    if (!zone.active) continue
    for (let j = from; j <= i; j++) {
      const c = data[j]
      if (zone.kind === 'demand') {
        if (c.low < zone.bottom && c.close > zone.bottom) {
          grabs.push({
            index: j,
            time: c.time,
            type: 'bullish',
            level: c.low,
            zone,
            confidence: zone.strength,
          })
        }
      } else if (c.high > zone.top && c.close < zone.top) {
        grabs.push({
          index: j,
          time: c.time,
          type: 'bearish',
          level: c.high,
          zone,
          confidence: zone.strength,
        })
      }
    }
  }

  grabs.sort((a, b) => b.time - a.time)
  return grabs
}

function pickNearestDemand(zones: SupplyDemandZone[], price: number): SupplyDemandZone | null {
  let best: SupplyDemandZone | null = null
  for (const z of zones) {
    if (z.kind !== 'demand' || !z.active) continue
    if (z.top > price * 1.01) continue
    if (!best || z.top > best.top) best = z
  }
  return best
}

function tagZones(
  zones: SupplyDemandZone[],
  timeframe: ZoneTimeframe,
  interval?: Interval,
): SupplyDemandZone[] {
  return zones.map((z) => ({
    ...z,
    timeframe,
    intervalLabel: interval ?? z.intervalLabel,
  }))
}

function priceTouchesZone(price: number, zone: SupplyDemandZone, eps: number): boolean {
  return price >= zone.bottom - eps && price <= zone.top + eps
}

function grabConfirmsHtfZone(grab: SupplyDemandGrab, htf: SupplyDemandZone): boolean {
  if (htf.kind === 'demand' && grab.type !== 'bullish') return false
  if (htf.kind === 'supply' && grab.type !== 'bearish') return false
  return grab.level >= htf.bottom * 0.998 && grab.level <= htf.top * 1.002
}

function buildMtfSetups(
  price: number,
  htfZones: SupplyDemandZone[],
  ltfGrabs: SupplyDemandGrab[],
  spread: number,
  ltfBarIndex: number,
  grabLookback = 8,
): { long: MtfSetup | null; short: MtfSetup | null } {
  const touchEps = price * 0.003
  const recentGrabs = ltfGrabs.filter((g) => g.index >= Math.max(0, ltfBarIndex - grabLookback))

  let long: MtfSetup | null = null
  let short: MtfSetup | null = null

  for (const z of htfZones) {
    if (!z.active || z.timeframe !== 'htf') continue

    if (z.kind === 'demand' && priceTouchesZone(price, z, touchEps)) {
      const grab = recentGrabs.find((g) => g.type === 'bullish' && grabConfirmsHtfZone(g, z))
      const setup: MtfSetup = {
        dir: 'long',
        htfZone: z,
        ltfGrab: grab ?? null,
        entry: z.top + spread,
        sl: z.mid,
        confirmed: grab != null,
      }
      if (!long || z.strength > long.htfZone.strength) long = setup
    }

    if (z.kind === 'supply' && priceTouchesZone(price, z, touchEps)) {
      const grab = recentGrabs.find((g) => g.type === 'bearish' && grabConfirmsHtfZone(g, z))
      const setup: MtfSetup = {
        dir: 'short',
        htfZone: z,
        ltfGrab: grab ?? null,
        entry: z.bottom - spread,
        sl: z.mid,
        confirmed: grab != null,
      }
      if (!short || z.strength > short.htfZone.strength) short = setup
    }
  }

  return { long, short }
}

function pickNearestSupply(zones: SupplyDemandZone[], price: number): SupplyDemandZone | null {
  let best: SupplyDemandZone | null = null
  for (const z of zones) {
    if (z.kind !== 'supply' || !z.active) continue
    if (z.bottom < price * 0.99) continue
    if (!best || z.bottom < best.bottom) best = z
  }
  return best
}

/**
 * Compute Supply & Demand zones, liquidity grabs, and FX-style entry/SL hints.
 */
export function computeSupplyDemand(
  data: Candle[],
  config: SupplyDemandConfig = {},
): SupplyDemandResult {
  if (data.length < 5) return EMPTY

  const cfg = { ...DEFAULT_CFG, ...config }
  const ltfZones = tagZones(detectZones(data, cfg), 'ltf', config.ltfInterval ?? undefined)

  let htfZones: SupplyDemandZone[] = []
  const htfData = config.htfData
  const htfInterval = config.htfInterval ?? null
  if (htfData && htfData.length >= cfg.minImpulseBars + 2 && htfInterval) {
    const htfCfg = { ...cfg, maxZones: Math.min(cfg.maxZones, 8) }
    htfZones = tagZones(detectZones(htfData, htfCfg), 'htf', htfInterval)
  }

  const allZones = [...ltfZones, ...htfZones]
  const grabs = detectGrabs(data, allZones)
  const price = data[data.length - 1].close
  const spread = price * cfg.spreadFrac
  const barIndex = data.length - 1

  const nearestDemand = pickNearestDemand(ltfZones, price)
  const nearestSupply = pickNearestSupply(ltfZones, price)
  const nearestHtfDemand = pickNearestHtfFromList(htfZones, price, 'demand')
  const nearestHtfSupply = pickNearestHtfFromList(htfZones, price, 'supply')

  const { long: mtfLong, short: mtfShort } = buildMtfSetups(
    price,
    htfZones,
    grabs,
    spread,
    barIndex,
  )

  const touchEps = price * 0.003
  let longEntry: number | null = null
  let longSl: number | null = null
  let shortEntry: number | null = null
  let shortSl: number | null = null

  if (mtfLong?.confirmed) {
    longEntry = mtfLong.entry
    longSl = mtfLong.sl
  } else if (nearestHtfDemand && priceTouchesZone(price, nearestHtfDemand, touchEps)) {
    longEntry = nearestHtfDemand.top + spread
    longSl = nearestHtfDemand.mid
  } else if (nearestDemand && priceTouchesZone(price, nearestDemand, touchEps)) {
    longEntry = nearestDemand.top + spread
    longSl = nearestDemand.mid
  }

  if (mtfShort?.confirmed) {
    shortEntry = mtfShort.entry
    shortSl = mtfShort.sl
  } else if (nearestHtfSupply && priceTouchesZone(price, nearestHtfSupply, touchEps)) {
    shortEntry = nearestHtfSupply.bottom - spread
    shortSl = nearestHtfSupply.mid
  } else if (nearestSupply && priceTouchesZone(price, nearestSupply, touchEps)) {
    shortEntry = nearestSupply.bottom - spread
    shortSl = nearestSupply.mid
  }

  return {
    zones: allZones,
    grabs,
    nearestDemand,
    nearestSupply,
    htfInterval,
    nearestHtfDemand,
    nearestHtfSupply,
    mtfLong,
    mtfShort,
    longEntry,
    longSl,
    shortEntry,
    shortSl,
  }
}

function pickNearestHtfFromList(
  zones: SupplyDemandZone[],
  price: number,
  kind: ZoneKind,
): SupplyDemandZone | null {
  let best: SupplyDemandZone | null = null
  for (const z of zones) {
    if (z.timeframe !== 'htf' || z.kind !== kind || !z.active) continue
    if (kind === 'demand' && z.top > price * 1.015) continue
    if (kind === 'supply' && z.bottom < price * 0.985) continue
    if (kind === 'demand') {
      if (!best || z.top > best.top) best = z
    } else if (!best || z.bottom < best.bottom) {
      best = z
    }
  }
  return best
}

function priceTouchesHtf(zone: SupplyDemandZone, price: number): boolean {
  const eps = price * 0.003
  return price >= zone.bottom - eps && price <= zone.top + eps
}

export interface SupplyDemandVotes {
  bull: number
  bear: number
  reasons: string[]
}

/**
 * Confluence votes for trade setup from active S/D context and recent grabs.
 */
export function collectSupplyDemandVotes(
  data: Candle[],
  sd: SupplyDemandResult,
): SupplyDemandVotes {
  const out: SupplyDemandVotes = { bull: 0, bear: 0, reasons: [] }
  if (!data.length) return out

  const i = data.length - 1
  const price = data[i].close
  const touchEps = price * 0.002

  if (sd.nearestDemand) {
    const z = sd.nearestDemand
    const touching = price >= z.bottom - touchEps && price <= z.top + touchEps
    if (touching) {
      out.bull++
      out.reasons.push('At Demand Zone (support)')
    }
  }

  if (sd.nearestSupply) {
    const z = sd.nearestSupply
    const touching = price <= z.top + touchEps && price >= z.bottom - touchEps
    if (touching) {
      out.bear++
      out.reasons.push('At Supply Zone (resistance)')
    }
  }

  const recentGrab = sd.grabs.find(
    (g) => g.index >= Math.max(0, i - 3) && g.zone.timeframe === 'ltf',
  )
  if (recentGrab) {
    if (recentGrab.type === 'bullish') {
      out.bull++
      out.reasons.push('S/D Liquidity Grab Long')
    } else {
      out.bear++
      out.reasons.push('S/D Liquidity Grab Short')
    }
  }

  if (sd.mtfLong?.confirmed) {
    out.bull += 2
    const label = sd.htfInterval ? `HTF ${sd.htfInterval}` : 'HTF'
    out.reasons.push(`MTF Demand + LTF grab (${label})`)
  } else if (sd.nearestHtfDemand && priceTouchesHtf(sd.nearestHtfDemand, price)) {
    out.bull++
    const label = sd.htfInterval ? `HTF ${sd.htfInterval}` : 'HTF'
    out.reasons.push(`At HTF Demand zone (${label})`)
  }

  if (sd.mtfShort?.confirmed) {
    out.bear += 2
    const label = sd.htfInterval ? `HTF ${sd.htfInterval}` : 'HTF'
    out.reasons.push(`MTF Supply + LTF grab (${label})`)
  } else if (sd.nearestHtfSupply && priceTouchesHtf(sd.nearestHtfSupply, price)) {
    out.bear++
    const label = sd.htfInterval ? `HTF ${sd.htfInterval}` : 'HTF'
    out.reasons.push(`At HTF Supply zone (${label})`)
  }

  return out
}
