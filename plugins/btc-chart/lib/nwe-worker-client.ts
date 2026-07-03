// BTC Chart — async Lux NWE via Web Worker (main-thread WASM/JS fallback).

import { computeNadarayaWatson } from '../smc-wasm'
import type { NadarayaWatsonConfig, NadarayaWatsonResult } from './nadaraya-watson'
import type { Candle } from './types'

interface NweWorkerReply {
  readonly id: number
  readonly result?: NadarayaWatsonResult
  readonly error?: string
}

let worker: Worker | null = null
let workerFailed = false
const pending = new Map<
  number,
  {
    readonly resolve: (result: NadarayaWatsonResult) => void
    readonly reject: (error: Error) => void
  }
>()
let nextJobId = 0

function ensureWorker(): Worker | null {
  if (workerFailed || typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./nwe-worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent<NweWorkerReply>) => {
      const { id, result, error } = ev.data ?? {}
      const job = pending.get(id)
      if (!job) return
      pending.delete(id)
      if (error || !result) job.reject(new Error(error ?? 'NWE worker failed'))
      else job.resolve(result)
    }
    worker.onerror = () => {
      workerFailed = true
      worker = null
      for (const [, job] of pending) job.reject(new Error('NWE worker error'))
      pending.clear()
    }
    return worker
  } catch {
    workerFailed = true
    return null
  }
}

/**
 * Compute Lux NWE off the main thread when a worker is available.
 * Falls back to sync WASM/JS on the main thread.
 */
export function computeLuxNweAsync(
  candles: Candle[],
  cfg: Partial<NadarayaWatsonConfig>,
): Promise<NadarayaWatsonResult> {
  const w = ensureWorker()
  if (!w) {
    return Promise.resolve(computeNadarayaWatson(candles, cfg))
  }
  return new Promise((resolve, reject) => {
    const id = ++nextJobId
    pending.set(id, { resolve, reject })
    w.postMessage({ candles, cfg, id })
  })
}

/** Pad worker NWE output when repaint window is shorter than full history. */
export function padLuxNweResult(
  luxNwe: NadarayaWatsonResult,
  dataLength: number,
  inputLength: number,
): NadarayaWatsonResult {
  if (inputLength >= dataLength) return luxNwe
  const pad = dataLength - inputLength
  return {
    mid: [...Array(pad).fill(null), ...luxNwe.mid],
    upper: [...Array(pad).fill(null), ...luxNwe.upper],
    lower: [...Array(pad).fill(null), ...luxNwe.lower],
    signals: luxNwe.signals.map((s) => ({ ...s, index: s.index + pad })),
  }
}
