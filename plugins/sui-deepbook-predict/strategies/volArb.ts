/**
 * Vol-Arb Strategy: Predict ↔ External Markets
 *
 * Back-solves Predict's implied vol from OracleSVI, compares against
 * external BTC option/perp implied vol, and identifies spread opportunities.
 *
 * When spread exceeds threshold → signal to trade.
 * Stretch: delta-hedge on Hyperliquid perps for pure vol edge.
 */

import type { SurfaceResult } from '../types'

export interface ExternalVolData {
  source: string
  price: number
  impliedVol?: number // annualized IV %
  timestamp: number
}

export interface VolSpreadResult {
  predictATMVol: number
  externalVols: { source: string; vol: number; spread: number }[]
  signal: 'buy_predict' | 'sell_predict' | 'neutral'
  spreadThreshold: number
  maxSpread: number
  kellyFraction: number
}

/**
 * Compute vol spread between Predict SVI surface and external sources.
 *
 * Logic:
 * 1. Extract ATM IV from Predict surface
 * 2. Estimate external IV from price moves (realized vol proxy)
 * 3. Compare: if Predict IV >> External → sell predict (overpriced)
 *             if Predict IV << External → buy predict (underpriced)
 */
export function computeVolSpread(
  surface: SurfaceResult | null,
  externalPrices: { source: string; price: number }[],
  historicalPrices: number[],
  threshold: number = 5, // 5% IV spread threshold
): VolSpreadResult | null {
  if (!surface || surface.surface.length === 0) return null

  // 1. Predict ATM vol (closest to moneyness = 0)
  const atmPoint = surface.surface.reduce((best, p) =>
    Math.abs(p.moneyness) < Math.abs(best.moneyness) ? p : best,
  )
  const predictATMVol = atmPoint.iv

  // 2. Estimate realized vol from historical prices (annualized)
  const realizedVol = estimateRealizedVol(historicalPrices)

  // 3. Compare with external sources
  const externalVols: { source: string; vol: number; spread: number }[] = []

  if (realizedVol > 0) {
    externalVols.push({
      source: 'Realized (1h)',
      vol: realizedVol,
      spread: predictATMVol - realizedVol,
    })
  }

  // Use price dispersion across sources as a vol proxy
  if (externalPrices.length >= 2) {
    const prices = externalPrices.map((p) => p.price)
    const mean = prices.reduce((s, p) => s + p, 0) / prices.length
    const variance = prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length
    const crossExchangeVol = (Math.sqrt(variance) / mean) * 100 * Math.sqrt(365 * 24) // annualize
    if (crossExchangeVol > 0) {
      externalVols.push({
        source: 'Cross-Exchange',
        vol: crossExchangeVol,
        spread: predictATMVol - crossExchangeVol,
      })
    }
  }

  // 4. Signal
  const maxSpread =
    externalVols.length > 0 ? Math.max(...externalVols.map((v) => Math.abs(v.spread))) : 0

  let signal: VolSpreadResult['signal'] = 'neutral'
  if (maxSpread > threshold) {
    const avgSpread = externalVols.reduce((s, v) => s + v.spread, 0) / (externalVols.length || 1)
    signal = avgSpread > 0 ? 'sell_predict' : 'buy_predict'
  }

  // 5. Kelly fraction (simplified)
  // f* = (p*b - q) / b where p = win prob, b = odds, q = 1-p
  // Approximate: edge / variance
  const edge = maxSpread / 100
  const kellyFraction = Math.min(0.25, Math.max(0, edge / (predictATMVol / 100)))

  return {
    predictATMVol,
    externalVols,
    signal,
    spreadThreshold: threshold,
    maxSpread,
    kellyFraction,
  }
}

/** Estimate annualized realized volatility from price series */
function estimateRealizedVol(prices: number[]): number {
  if (prices.length < 3) return 0
  const returns: number[] = []
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push(Math.log(prices[i] / prices[i - 1]))
    }
  }
  if (returns.length < 2) return 0
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1)
  // Assume ~1 update per second, annualize
  const periodsPerYear = 365.25 * 24 * 3600
  return Math.sqrt(variance * periodsPerYear) * 100
}
