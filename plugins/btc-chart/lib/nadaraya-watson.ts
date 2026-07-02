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
  repaint: true,
  maxBarsBack: 500,
}

/**
 * Gaussian window function
 * gauss(x, h) = exp(-(x^2 / (h^2 * 2)))
 */
function gauss(x: number, h: number): number {
  return Math.exp(-(Math.pow(x, 2) / (h * h * 2)))
}

/** LuxAlgo contrarian crosses: buy on recovery above lower, sell on rejection below upper. */
function detectBandCrossSignals(
  src: number[],
  upper: (number | null)[],
  lower: (number | null)[],
  start = 1,
): Array<{ index: number; type: 'buy' | 'sell'; price: number }> {
  const signals: Array<{ index: number; type: 'buy' | 'sell'; price: number }> = []
  for (let i = start; i < src.length; i++) {
    const prevUpper = upper[i - 1]
    const currUpper = upper[i]
    const prevLower = lower[i - 1]
    const currLower = lower[i]
    if (prevUpper == null || currUpper == null || prevLower == null || currLower == null) continue

    const prevSrc = src[i - 1]
    const currSrc = src[i]

    if (prevSrc < prevLower && currSrc > currLower) {
      signals.push({ index: i, type: 'buy', price: currSrc })
    } else if (prevSrc > prevUpper && currSrc < currUpper) {
      signals.push({ index: i, type: 'sell', price: currSrc })
    }
  }
  return signals
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
 * - Signals remain fixed once confirmed
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

  if (n === 0) {
    return { mid, upper, lower, signals: [] }
  }

  if (cfg.repaint) {
    const maxBars = Math.min(cfg.maxBarsBack, n)
    const nwe: number[] = []

    for (let i = 0; i < maxBars; i++) {
      let sum = 0
      let sumw = 0
      for (let j = 0; j < maxBars; j++) {
        const w = gauss(i - j, cfg.bandwidth)
        sum += src[n - maxBars + j] * w
        sumw += w
      }
      nwe.push(sum / sumw)
    }

    let saeSum = 0
    for (let i = 0; i < maxBars; i++) {
      saeSum += Math.abs(src[n - maxBars + i] - nwe[i])
    }
    const sae = (saeSum / maxBars) * cfg.multiplier

    for (let i = 0; i < maxBars; i++) {
      const idx = n - maxBars + i
      mid[idx] = nwe[i]
      upper[idx] = nwe[i] + sae
      lower[idx] = nwe[i] - sae
    }

    const windowStart = n - maxBars
    const signals = detectBandCrossSignals(src, upper, lower, Math.max(1, windowStart))
    return { mid, upper, lower, signals }
  }

  const coefs: number[] = []
  for (let i = 0; i < cfg.maxBarsBack; i++) {
    coefs.push(gauss(i, cfg.bandwidth))
  }

  const maeValues: number[] = []
  for (let i = 0; i < n; i++) {
    const barsToUse = Math.min(cfg.maxBarsBack, i + 1)
    let num = 0
    let den = 0
    for (let j = 0; j < barsToUse; j++) {
      const w = coefs[j]
      num += src[i - j] * w
      den += w
    }
    const out = num / den
    mid[i] = out
    maeValues.push(Math.abs(src[i] - out))
  }

  for (let i = 0; i < n; i++) {
    const period = Math.min(499, i + 1)
    let errSum = 0
    for (let k = i - period + 1; k <= i; k++) {
      errSum += maeValues[k]
    }
    const mae = (errSum / period) * cfg.multiplier
    upper[i] = (mid[i] as number) + mae
    lower[i] = (mid[i] as number) - mae
  }

  const signals = detectBandCrossSignals(src, upper, lower)
  return { mid, upper, lower, signals }
}
