// BTC Chart — interval-scaled EMA periods for Trade Setup context (not votes).

import type { Interval } from './constants'
import { calcEMA } from './indicators'
import type { Candle } from './types'

/** Fast/slow EMA lengths chosen per chart interval. */
export interface AdaptiveMaPeriods {
  readonly fast: number
  readonly slow: number
  /** Compact label, e.g. "9/21". */
  readonly label: string
}

/**
 * Map interval to adaptive MA periods:
 * 1m–15m → 9/21, 1h → 20/50, 4h+ → 50/200.
 */
export function getAdaptiveMaPeriods(interval: Interval): AdaptiveMaPeriods {
  switch (interval) {
    case '1m':
    case '5m':
    case '15m':
      return { fast: 9, slow: 21, label: '9/21' }
    case '1h':
      return { fast: 20, slow: 50, label: '20/50' }
    case '4h':
    case '1d':
      return { fast: 50, slow: 200, label: '50/200' }
    default:
      return { fast: 9, slow: 21, label: '9/21' }
  }
}

/** Full fast/slow EMA series aligned to candles. */
export interface AdaptiveMaSeries {
  readonly fast: number[]
  readonly slow: number[]
  readonly periods: AdaptiveMaPeriods
}

/** Compute adaptive EMA series for the active interval. */
export function computeAdaptiveMaSeries(data: Candle[], interval: Interval): AdaptiveMaSeries {
  const periods = getAdaptiveMaPeriods(interval)
  return {
    fast: calcEMA(data, periods.fast),
    slow: calcEMA(data, periods.slow),
    periods,
  }
}

/** Latest-bar adaptive MA values passed into Trade Setup. */
export interface AdaptiveMaSnapshot {
  readonly fast: number | null
  readonly slow: number | null
  readonly fastPeriod: number
  readonly slowPeriod: number
  readonly label: string
}

/** Read adaptive MA at bar `index` (typically the latest candle). */
export function snapshotAdaptiveMa(series: AdaptiveMaSeries, index: number): AdaptiveMaSnapshot {
  const fast = series.fast[index]
  const slow = series.slow[index]
  return {
    fast: Number.isFinite(fast) ? fast : null,
    slow: Number.isFinite(slow) ? slow : null,
    fastPeriod: series.periods.fast,
    slowPeriod: series.periods.slow,
    label: series.periods.label,
  }
}

/**
 * Lux + SMC context gate: Long needs close above fast EMA; Short needs close below.
 * Returns true when MA data is missing (do not block plan).
 */
export function passesMaContextFilter(
  dir: 'long' | 'short',
  close: number,
  ma: AdaptiveMaSnapshot,
): boolean {
  if (ma.fast == null) return true
  if (dir === 'long') return close > ma.fast
  return close < ma.fast
}

/** Context note when MA alignment passes (no vote). */
export function maContextPassReason(dir: 'long' | 'short', fastPeriod: number): string {
  return dir === 'long'
    ? `MA context: close above fast EMA(${fastPeriod})`
    : `MA context: close below fast EMA(${fastPeriod})`
}

/** Block note when plan direction fails the MA gate (no vote). */
export function maContextBlockReason(dir: 'long' | 'short', fastPeriod: number): string {
  return dir === 'long'
    ? `MA blocked: close below fast EMA(${fastPeriod})`
    : `MA blocked: close above fast EMA(${fastPeriod})`
}

/** True when a reason string indicates the MA gate blocked plan lock. */
export function isMaContextBlockReason(reason: string): boolean {
  return reason.startsWith('MA blocked:')
}

/** Short UI hint when bias has votes but MA context blocks plan lock. */
export function maContextBlockHint(reasons: readonly string[]): string | null {
  const block = reasons.find(isMaContextBlockReason)
  if (!block) return null
  const m = block.match(/EMA\((\d+)\)/)
  const p = m?.[1] ?? '?'
  if (block.includes('below fast')) return `Chờ close > EMA(${p}) để khóa Long`
  if (block.includes('above fast')) return `Chờ close < EMA(${p}) để khóa Short`
  return null
}
