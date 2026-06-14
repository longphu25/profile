import type { RealizedVol } from '../domain/volSurface'
import { fetchBinanceRefHistory } from '../infrastructure/binanceRefService'

/**
 * Realized-volatility estimate (plan 23, S2).
 *
 * Pure annualized realized vol from a short window of 1-minute closes: stddev of
 * log returns scaled by sqrt(bars per year). This sits next to the surface ATM IV
 * so a trader can read the implied-vs-realized spread (the classic vol-trader
 * edge). The window is short by design (sub-hour Predict expiries), so the result
 * is always reported WITH its window length - never oversold as a long-run figure.
 */

const MINUTES_PER_YEAR = 365 * 24 * 60

/**
 * Annualized realized vol from 1-minute closes. Returns a null value (not a fake
 * zero) when there are too few points to form at least two returns.
 */
export function computeRealizedVol(closes: number[], windowMinutes: number): RealizedVol {
  const usable = closes.filter((c) => Number.isFinite(c) && c > 0)
  if (usable.length < 3) {
    return { value: null, sampleCount: Math.max(0, usable.length - 1), windowMinutes }
  }

  const returns: number[] = []
  for (let i = 1; i < usable.length; i += 1) {
    returns.push(Math.log(usable[i] / usable[i - 1]))
  }

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + (r - mean) * (r - mean), 0) / (returns.length - 1)
  const perMinuteVol = Math.sqrt(variance)
  const annualized = perMinuteVol * Math.sqrt(MINUTES_PER_YEAR)

  return {
    value: Number.isFinite(annualized) ? annualized : null,
    sampleCount: returns.length,
    windowMinutes,
  }
}

/**
 * Fetch the recent 1-minute BTC closes (no CORS) and compute realized vol. The
 * window length is derived from the number of bars returned, so the label stays
 * honest if Binance returns fewer than requested.
 */
export async function fetchRealizedVol(): Promise<RealizedVol> {
  const history = await fetchBinanceRefHistory()
  const closes = history.map((p) => p.price)
  // Binance history is 1-minute bars; the window is the span the bars cover.
  const windowMinutes = Math.max(0, closes.length - 1)
  return computeRealizedVol(closes, windowMinutes)
}
