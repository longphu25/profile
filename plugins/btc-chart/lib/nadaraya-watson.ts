// BTC Chart — Nadaraya-Watson Envelope [LuxAlgo] implementation
// Ported from PineScript: https://www.tradingview.com/script/2flMD9vN/
// License: CC BY-NC-SA 4.0

import type { Candle } from './types'

export interface NadarayaWatsonResult {
  mid: (number | null)[]
  upper: (number | null)[]
  lower: (number | null)[]
  signals: Array<{
    index: number
    type: 'buy' | 'sell'
    price: number
  }>
}

export interface NadarayaWatsonConfig {
  bandwidth: number
  multiplier: number
  repaint: boolean
  maxBarsBack: number
}

const DEFAULT_CONFIG: NadarayaWatsonConfig = {
  bandwidth: 8,
  multiplier: 3,
  repaint: false,
  maxBarsBack: 250,
}

/**
 * Gaussian window function
 * gauss(x, h) = exp(-(x^2 / (h^2 * 2)))
 */
function gauss(x: number, h: number): number {
  return Math.exp(-(Math.pow(x, 2) / (h * h * 2)))
}

/**
 * Calculate Nadaraya-Watson Envelope with Repainting Smoothing
 *
 * Repainting mode: Recomputes all historical points on each new bar
 * - More accurate but historical values change
 * - Signals appear on past bars after the fact
 *
 * Non-repainting mode: Only computes endpoint (current bar)
 * - Historical values stay fixed
 * - Signals only appear on current bar
 */
export function calcNadarayaWatson(
  data: Candle[],
  config: Partial<NadarayaWatsonConfig> = {},
): NadarayaWatsonResult {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const n = data.length
  const src = data.map((c) => c.close)

  const mid = new Array<number | null>(n).fill(null)
  const upper = new Array<number | null>(n).fill(null)
  const lower = new Array<number | null>(n).fill(null)
  const signals: Array<{ index: number; type: 'buy' | 'sell'; price: number }> = []

  if (cfg.repaint) {
    // Repainting mode: compute all points on last bar
    const maxBars = Math.min(cfg.maxBarsBack, n)
    const nwe: number[] = []

    // Compute NWE for all bars in window
    for (let i = 0; i < maxBars; i++) {
      let sum = 0
      let sumw = 0
      // Weighted mean using Gaussian kernel
      for (let j = 0; j < maxBars; j++) {
        const w = gauss(i - j, cfg.bandwidth)
        sum += src[n - maxBars + j] * w
        sumw += w
      }
      const y = sum / sumw
      nwe.push(y)
    }

    // Compute SAE (Smoothed Absolute Error)
    let saeSum = 0
    for (let i = 0; i < maxBars; i++) {
      saeSum += Math.abs(src[n - maxBars + i] - nwe[i])
    }
    const sae = (saeSum / maxBars) * cfg.multiplier

    // Fill arrays from end
    for (let i = 0; i < maxBars; i++) {
      const idx = n - maxBars + i
      mid[idx] = nwe[i]
      upper[idx] = nwe[i] + sae
      lower[idx] = nwe[i] - sae

      // Detect crossovers (compare with previous bar)
      if (i > 0) {
        const prevSrc = src[idx - 1]
        const currSrc = src[idx]
        const prevUpper = nwe[i - 1] + sae
        const currUpper = nwe[i] + sae
        const prevLower = nwe[i - 1] - sae
        const currLower = nwe[i] - sae

        // Crossover upper: price crosses above upper band → sell signal
        if (prevSrc < prevUpper && currSrc > currUpper) {
          signals.push({ index: idx, type: 'sell', price: currSrc })
        }
        // Crossunder lower: price crosses below lower band → buy signal
        else if (prevSrc > prevLower && currSrc < currLower) {
          signals.push({ index: idx, type: 'buy', price: currSrc })
        }
      }
    }
  } else {
    // Non-repainting mode: compute endpoint only
    // Pre-compute Gaussian coefficients
    const coefs: number[] = []
    let den = 0
    for (let i = 0; i < cfg.maxBarsBack; i++) {
      const w = gauss(i, cfg.bandwidth)
      coefs.push(w)
      den += w
    }

    // Compute MAE using SMA
    const maeValues: number[] = []
    for (let i = 0; i < n; i++) {
      let out = 0
      const barsToUse = Math.min(cfg.maxBarsBack, i + 1)
      for (let j = 0; j < barsToUse; j++) {
        out += src[i - j] * coefs[j]
      }
      out /= den

      mid[i] = out
      maeValues.push(Math.abs(src[i] - out))
    }

    // Compute MAE as SMA of absolute errors
    const maePeriod = Math.min(499, n)
    let maeSum = 0
    for (let i = 0; i < maePeriod; i++) {
      maeSum += maeValues[i]
    }
    const mae = (maeSum / maePeriod) * cfg.multiplier

    // Fill upper/lower
    for (let i = 0; i < n; i++) {
      if (mid[i] !== null) {
        upper[i] = (mid[i] as number) + mae
        lower[i] = (mid[i] as number) - mae
      }
    }

    // Detect signals only on last bar
    if (n >= 2) {
      const prevSrc = src[n - 2]
      const currSrc = src[n - 1]
      const prevUpper = upper[n - 2] as number
      const currUpper = upper[n - 1] as number
      const prevLower = lower[n - 2] as number
      const currLower = lower[n - 1] as number

      if (prevSrc < prevUpper && currSrc > currUpper) {
        signals.push({ index: n - 1, type: 'sell', price: currSrc })
      } else if (prevSrc > prevLower && currSrc < currLower) {
        signals.push({ index: n - 1, type: 'buy', price: currSrc })
      }
    }
  }

  return { mid, upper, lower, signals }
}
