import { PRICE_SCALE, STRIKE_SCALE } from './constants'
import type { ButterflyViolation, SVIParams, SurfaceResult } from './types'

const YEAR_MS = 365.25 * 24 * 3600 * 1000
const MIN_TIME_TO_EXPIRY_YEARS = 1 / 365

export function normalizeSVIParams(svi: SVIParams) {
  return {
    a: svi.a / 1e6,
    b: svi.b / 1e6,
    rho: ((svi.rho_negative ? -1 : 1) * svi.rho) / 1e9,
    m: ((svi.m_negative ? -1 : 1) * svi.m) / 1e6,
    sigma: svi.sigma / 1e6,
  }
}

export function yearsToExpiry(expiryMs: number, nowMs = Date.now()): number {
  return Math.max((expiryMs - nowMs) / YEAR_MS, MIN_TIME_TO_EXPIRY_YEARS)
}

export function totalVarianceAtLogMoneyness(svi: SVIParams, logMoneyness: number): number {
  const params = normalizeSVIParams(svi)
  const diff = logMoneyness - params.m
  return (
    params.a + params.b * (params.rho * diff + Math.sqrt(diff * diff + params.sigma * params.sigma))
  )
}

export function normalCDF(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const sign = x < 0 ? -1 : 1
  const abs = Math.abs(x) / Math.SQRT2
  const t = 1 / (1 + p * abs)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-abs * abs)
  return 0.5 * (1 + sign * y)
}

export function computeSVISurface(
  svi: SVIParams,
  forward: number,
  expiryMs: number,
  minStrike: number,
  tickSize: number,
  nowMs = Date.now(),
): SurfaceResult {
  const params = normalizeSVIParams(svi)
  const F = forward / PRICE_SCALE
  const T = yearsToExpiry(expiryMs, nowMs)

  const strikes: number[] = []
  const lo = Math.max(minStrike / STRIKE_SCALE, F * 0.7)
  const hi = F * 1.3
  const tick = tickSize / STRIKE_SCALE
  for (let s = lo; s <= hi; s += tick) strikes.push(s)

  const step = Math.max(1, Math.floor(strikes.length / 30))
  const sampled = strikes.filter((_, i) => i % step === 0)
  const surface = sampled.map((K) => {
    const k = Math.log(K / F)
    const w = totalVarianceAtLogMoneyness(svi, k)
    const iv = w > 0 ? Math.sqrt(w / T) * 100 : 0
    return { strike: K, moneyness: k, iv, w }
  })

  return { surface, forward: F, T, params }
}

export function computeFairValue(
  svi: SVIParams,
  forward: number,
  expiry: number,
  strike: number,
  direction: number,
  nowMs = Date.now(),
): number {
  const F = forward / PRICE_SCALE
  const K = strike / STRIKE_SCALE
  if (K <= 0 || F <= 0) return 0

  const T = yearsToExpiry(expiry, nowMs)
  const k = Math.log(K / F)
  const w = totalVarianceAtLogMoneyness(svi, k)
  if (w <= 0) return 0

  const sqrtW = Math.sqrt(w / T)
  const d2 = -k / sqrtW - sqrtW / 2
  const pUp = normalCDF(d2)
  return direction === 0 ? pUp : 1 - pUp
}

export function computeRangeFairValue(
  svi: SVIParams,
  forward: number,
  expiry: number,
  lower: number,
  higher: number,
  nowMs = Date.now(),
): number {
  if (lower <= 0 || higher <= 0 || lower >= higher) return 0
  const pLower = computeFairValue(svi, forward, expiry, lower, 0, nowMs)
  const pHigher = computeFairValue(svi, forward, expiry, higher, 0, nowMs)
  const result = pLower - pHigher
  return Number.isFinite(result) ? result : 0
}

export function checkButterflyViolations(
  surface: { strike: number; iv: number }[],
): ButterflyViolation[] {
  const violations: ButterflyViolation[] = []
  for (let i = 1; i < surface.length - 1; i++) {
    const prev = surface[i - 1]
    const curr = surface[i]
    const next = surface[i + 1]
    const w = (next.strike - curr.strike) / (next.strike - prev.strike)
    const interp = w * prev.iv + (1 - w) * next.iv
    if (curr.iv > interp * 1.02) {
      violations.push({ strike: curr.strike, iv: curr.iv, expected: interp })
    }
  }
  return violations
}
