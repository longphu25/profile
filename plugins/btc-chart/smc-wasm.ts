/**
 * SMC WASM Bridge — loads WASM module with graceful JS fallback.
 *
 * Strategy: Try load WASM → if fail, use the pure JS computeSMC.
 * Same public API as smc.ts so callers swap import transparently.
 */

import { computeSMC as computeSMCJs } from './smc'
import type { SMCConfig, SMCResult } from './smc'

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface WasmModule {
  compute_smc: (candles: Candle[], cfg: SMCConfig) => SMCResult
}

let wasmModule: WasmModule | null = null
let wasmLoadAttempted = false

/**
 * Attempt to load the SMC WASM module.
 * Call once on plugin mount. Non-blocking — falls back to JS if unavailable.
 */
export async function initSmcWasm(): Promise<boolean> {
  if (wasmLoadAttempted) return wasmModule !== null
  wasmLoadAttempted = true

  try {
    const pkgUrl = `${import.meta.env.BASE_URL}plugins/btc-chart/pkg/btc_chart_wasm.js`
    const mod = (await import(/* @vite-ignore */ pkgUrl)) as unknown as {
      default: (input?: { module_or_path: URL }) => Promise<unknown>
    } & WasmModule
    await mod.default({
      module_or_path: new URL(
        `${import.meta.env.BASE_URL}plugins/btc-chart/pkg/btc_chart_wasm_bg.wasm`,
        location.origin,
      ),
    })
    wasmModule = mod as unknown as WasmModule
    console.log('[btc-chart] SMC WASM loaded — native compute')
    return true
  } catch (e) {
    console.log('[btc-chart] SMC WASM unavailable — JS fallback', e)
    return false
  }
}

/** Check if WASM is active */
export function isSmcWasmReady(): boolean {
  return wasmModule !== null
}

/**
 * Compute SMC overlay. Uses WASM if loaded, otherwise pure JS.
 * Drop-in replacement for computeSMC from smc.ts.
 */
export function computeSMC(candles: Candle[], cfg: SMCConfig): SMCResult {
  if (wasmModule) {
    try {
      return wasmModule.compute_smc(candles, cfg)
    } catch {
      // If WASM throws at runtime, fall back to JS for this call
      return computeSMCJs(candles, cfg)
    }
  }
  return computeSMCJs(candles, cfg)
}

export type { SMCConfig, SMCResult }
