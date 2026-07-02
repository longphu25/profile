/**
 * Web Worker for offloading Nadaraya-Watson Envelope (NWE) heavy compute.
 *
 * Usage (from main thread):
 *   const worker = new Worker(new URL('./nwe-worker.ts', import.meta.url), { type: 'module' })
 *   worker.postMessage({ candles, cfg })
 *   worker.onmessage = (e) => { const result = e.data }
 *
 * NOTE: This runs the pure JS version. For WASM, a separate approach (or offscreen WASM)
 * would be needed. Post large candle arrays; consider transferring if you convert to ArrayBuffers.
 */

import type { Candle } from './types'
import type { NadarayaWatsonConfig, NadarayaWatsonResult } from './nadaraya-watson'

// Minimal inline implementation to avoid module resolution quirks inside worker.
// Mirrors the logic in lib/nadaraya-watson.ts (repaint + non-repaint).

function gauss(x: number, h: number): number {
  return Math.exp(-(Math.pow(x, 2) / (h * h * 2)))
}

function computeNweInWorker(
  data: Candle[],
  config: Partial<NadarayaWatsonConfig>,
): NadarayaWatsonResult {
  const cfg = {
    bandwidth: config.bandwidth ?? 8,
    multiplier: config.multiplier ?? 3,
    repaint: config.repaint ?? false,
    maxBarsBack: config.maxBarsBack ?? 250,
  }
  const n = data.length
  const src = data.map((c) => c.close)

  const mid: (number | null)[] = new Array(n).fill(null)
  const upper: (number | null)[] = new Array(n).fill(null)
  const lower: (number | null)[] = new Array(n).fill(null)
  const signals: Array<{ index: number; type: 'buy' | 'sell'; price: number }> = []

  if (n === 0) return { mid, upper, lower, signals }

  const maxB = Math.min(cfg.maxBarsBack, n)

  if (cfg.repaint) {
    const nwe: number[] = []
    for (let i = 0; i < maxB; i++) {
      let sum = 0
      let sumw = 0
      for (let j = 0; j < maxB; j++) {
        const w = gauss(i - j, cfg.bandwidth)
        sum += src[n - maxB + j] * w
        sumw += w
      }
      nwe.push(sum / sumw)
    }
    let saeSum = 0
    for (let i = 0; i < maxB; i++) {
      saeSum += Math.abs(src[n - maxB + i] - nwe[i])
    }
    const sae = (saeSum / maxB) * cfg.multiplier

    for (let i = 0; i < maxB; i++) {
      const idx = n - maxB + i
      mid[idx] = nwe[i]
      upper[idx] = nwe[i] + sae
      lower[idx] = nwe[i] - sae
      if (i > 0) {
        const prevSrc = src[idx - 1]
        const currSrc = src[idx]
        const pU = nwe[i - 1] + sae
        const cU = nwe[i] + sae
        const pL = nwe[i - 1] - sae
        const cL = nwe[i] - sae
        if (prevSrc < pU && currSrc > cU) signals.push({ index: idx, type: 'sell', price: currSrc })
        else if (prevSrc > pL && currSrc < cL)
          signals.push({ index: idx, type: 'buy', price: currSrc })
      }
    }
  } else {
    const coefs: number[] = []
    let den = 0
    for (let i = 0; i < cfg.maxBarsBack; i++) {
      const w = gauss(i, cfg.bandwidth)
      coefs.push(w)
      den += w
    }
    const maeValues: number[] = []
    for (let i = 0; i < n; i++) {
      let out = 0
      const bars = Math.min(cfg.maxBarsBack, i + 1)
      for (let j = 0; j < bars; j++) out += src[i - j] * coefs[j]
      out /= den
      mid[i] = out
      maeValues.push(Math.abs(src[i] - out))
    }
    const maeP = Math.min(499, n)
    let maeSum = 0
    for (let i = 0; i < maeP; i++) maeSum += maeValues[i]
    const mae = (maeSum / maeP) * cfg.multiplier
    for (let i = 0; i < n; i++) {
      if (mid[i] != null) {
        upper[i] = (mid[i] as number) + mae
        lower[i] = (mid[i] as number) - mae
      }
    }
    if (n >= 2) {
      const prevSrc = src[n - 2]
      const currSrc = src[n - 1]
      const pU = upper[n - 2] as number
      const cU = upper[n - 1] as number
      const pL = lower[n - 2] as number
      const cL = lower[n - 1] as number
      if (prevSrc < pU && currSrc > cU) signals.push({ index: n - 1, type: 'sell', price: currSrc })
      else if (prevSrc > pL && currSrc < cL)
        signals.push({ index: n - 1, type: 'buy', price: currSrc })
    }
  }

  return { mid, upper, lower, signals }
}

// Worker message handler
self.onmessage = (ev: MessageEvent) => {
  const { candles, cfg, id } = ev.data || {}
  if (!Array.isArray(candles)) {
    ;(self as any).postMessage({ error: 'bad candles', id })
    return
  }
  try {
    const result = computeNweInWorker(candles as Candle[], cfg || {})
    ;(self as any).postMessage({ result, id })
  } catch (e) {
    ;(self as any).postMessage({ error: String(e), id })
  }
}

export {} // module
