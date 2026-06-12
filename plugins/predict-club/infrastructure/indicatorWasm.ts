/**
 * Indicator WASM Bridge — loads the predict-club WASM kernel with JS fallback.
 *
 * Infrastructure layer: wraps the native compute module behind a stable API.
 * Falls back to the pure JS deriveSignalsFromPrices when WASM is unavailable.
 */

import type { IndicatorSignal } from '../domain/types'
import type { OraclePrice } from './deepbookOracleService'

interface WasmModule {
  derive_signals: (prices: OraclePrice[]) => IndicatorSignal[]
}

let wasmModule: WasmModule | null = null
let wasmLoadAttempted = false

/**
 * Attempt to load the indicator WASM module.
 * Non-blocking — call once on plugin mount. Falls back to JS if unavailable.
 */
export async function initIndicatorWasm(): Promise<boolean> {
  if (wasmLoadAttempted) return wasmModule !== null
  wasmLoadAttempted = true

  try {
    const pkgUrl = `${import.meta.env.BASE_URL}plugins/predict-club/pkg/predict_club_wasm.js`
    const mod = (await import(/* @vite-ignore */ pkgUrl)) as unknown as {
      default: (input?: { module_or_path: URL }) => Promise<unknown>
    } & WasmModule
    await mod.default({
      module_or_path: new URL(
        `${import.meta.env.BASE_URL}plugins/predict-club/pkg/predict_club_wasm_bg.wasm`,
        location.origin,
      ),
    })
    wasmModule = mod as unknown as WasmModule
    console.log('[predict-club] indicator WASM loaded — native compute')
    return true
  } catch (e) {
    console.log('[predict-club] indicator WASM unavailable — JS fallback', e)
    return false
  }
}

/** Check if WASM is active */
export function isIndicatorWasmReady(): boolean {
  return wasmModule !== null
}

/**
 * Derive signals via WASM if loaded, else null (caller uses JS fallback).
 * Returns null when WASM is not ready so the gateway keeps its JS path.
 */
export function deriveSignalsWasm(prices: OraclePrice[]): IndicatorSignal[] | null {
  if (!wasmModule) return null
  try {
    return wasmModule.derive_signals(prices)
  } catch {
    return null
  }
}
