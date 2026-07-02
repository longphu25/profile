/**
 * Web Worker for offloading Nadaraya-Watson Envelope (NWE) heavy compute.
 *
 * Mirrors calcNadarayaWatson in lib/nadaraya-watson.ts (repaint + non-repaint).
 */

import type { Candle } from './types'
import { calcNadarayaWatson } from './nadaraya-watson'
import type { NadarayaWatsonConfig, NadarayaWatsonResult } from './nadaraya-watson'

self.onmessage = (ev: MessageEvent) => {
  const { candles, cfg, id } = ev.data || {}
  if (!Array.isArray(candles)) {
    ;(self as unknown as Worker).postMessage({ error: 'bad candles', id })
    return
  }
  try {
    const result: NadarayaWatsonResult = calcNadarayaWatson(
      candles as Candle[],
      (cfg || {}) as Partial<NadarayaWatsonConfig>,
    )
    ;(self as unknown as Worker).postMessage({ result, id })
  } catch (e) {
    ;(self as unknown as Worker).postMessage({ error: String(e), id })
  }
}

export {}
