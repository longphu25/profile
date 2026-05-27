/**
 * SVI (Stochastic Volatility Inspired) math for volatility surface computation.
 *
 * Formula: w(k) = a + b · (ρ·(k − m) + √((k − m)² + σ²))
 * IV(K) = √(w(k) / T) × 100%
 */

import { PRICE_SCALE, STRIKE_SCALE } from '../types'
import type { SVIParams, SurfaceResult, ButterflyViolation } from '../types'

export function computeSVISurface(
  svi: SVIParams,
  forward: number,
  expiryMs: number,
  minStrike: number,
  tickSize: number,
): SurfaceResult {
  const a = svi.a / 1e6
  const b = svi.b / 1e6
  const rho = ((svi.rho_negative ? -1 : 1) * svi.rho) / 1e9
  const m_val = ((svi.m_negative ? -1 : 1) * svi.m) / 1e6
  const sigma = svi.sigma / 1e6
  const F = forward / PRICE_SCALE
  const T = Math.max((expiryMs - Date.now()) / (365.25 * 24 * 3600 * 1000), 1 / 365)

  const strikes: number[] = []
  const lo = Math.max(minStrike / STRIKE_SCALE, F * 0.7)
  const hi = F * 1.3
  const tick = tickSize / STRIKE_SCALE
  for (let s = lo; s <= hi; s += tick) strikes.push(s)

  const step = Math.max(1, Math.floor(strikes.length / 30))
  const sampled = strikes.filter((_, i) => i % step === 0)

  const surface = sampled.map((K) => {
    const k = Math.log(K / F)
    const diff = k - m_val
    const w = a + b * (rho * diff + Math.sqrt(diff * diff + sigma * sigma))
    const iv = w > 0 ? Math.sqrt(w / T) * 100 : 0
    return { strike: K, moneyness: k, iv, w }
  })

  return { surface, forward: F, T, params: { a, b, rho, m: m_val, sigma } }
}

/**
 * Butterfly arbitrage check.
 * For 3 consecutive strikes K₁ < K₂ < K₃:
 * Expected_IV(K₂) = w·IV(K₁) + (1−w)·IV(K₃) where w = (K₃−K₂)/(K₃−K₁)
 * Violation if actual > expected × 1.02
 */
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
