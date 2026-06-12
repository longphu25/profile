/**
 * WASM Bridge — loads WASM module with graceful JS fallback.
 *
 * Strategy: Try load WASM → if fail, use pure JS implementations.
 * This ensures the plugin works everywhere, with WASM as a performance boost.
 */

import type { RouteQuote } from './types'

interface OrderBookLevel {
  price: number
  size: number
}

interface SimResult {
  output: number
  price_impact: number
  avg_price: number
  filled_percent: number
}

interface RankedQuote {
  dex: string
  output_amount: number
  price_impact: number
  fee: number
  estimated_gas: number
  score: number
  rank: number
}

interface WasmModule {
  simulate_market_order: (amount: number, isBuy: boolean, levels: OrderBookLevel[]) => SimResult
  rank_quotes: (quotes: QuoteEntry[], priceImpactWeight: number) => RankedQuote[]
}

interface QuoteEntry {
  dex: string
  output_amount: number
  price_impact: number
  fee: number
  estimated_gas: number
}

let wasmModule: WasmModule | null = null
let wasmLoadAttempted = false

/**
 * Attempt to load the WASM module.
 * Call once on plugin init. Non-blocking — falls back to JS if unavailable.
 */
export async function initWasm(): Promise<boolean> {
  if (wasmLoadAttempted) return wasmModule !== null
  wasmLoadAttempted = true

  try {
    const pkgUrl = `${import.meta.env.BASE_URL}plugins/sui-swap/pkg/sui_swap_wasm.js`
    const mod = (await import(/* @vite-ignore */ pkgUrl)) as unknown as {
      default: (input?: { module_or_path: URL }) => Promise<unknown>
    } & WasmModule
    await mod.default({
      module_or_path: new URL(
        `${import.meta.env.BASE_URL}plugins/sui-swap/pkg/sui_swap_wasm_bg.wasm`,
        location.origin,
      ),
    })
    wasmModule = mod as unknown as WasmModule
    console.log('[SuiSwap] WASM loaded — using native compute')
    return true
  } catch (e) {
    console.log('[SuiSwap] WASM unavailable — using JS fallback', e)
    return false
  }
}

/** Check if WASM is active */
export function isWasmReady(): boolean {
  return wasmModule !== null
}

// ─── Pure JS Fallback Implementations ────────────────────────────────────────

function jsSimulateMarketOrder(
  amount: number,
  isBuy: boolean,
  levels: OrderBookLevel[],
): SimResult {
  if (amount <= 0 || levels.length === 0) {
    return { output: 0, price_impact: 0, avg_price: 0, filled_percent: 0 }
  }

  const bestPrice = levels[0].price
  let remaining = amount
  let filled = 0

  for (const { price, size } of levels) {
    if (remaining <= 0) break
    if (isBuy) {
      const levelCost = price * size
      if (remaining >= levelCost) {
        remaining -= levelCost
        filled += size
      } else {
        filled += remaining / price
        remaining = 0
      }
    } else {
      if (remaining >= size) {
        remaining -= size
        filled += size * price
      } else {
        filled += remaining * price
        remaining = 0
      }
    }
  }

  const spent = amount - remaining
  const avgPrice = isBuy ? (filled > 0 ? spent / filled : 0) : spent > 0 ? filled / spent : 0
  const priceImpact = bestPrice > 0 ? Math.abs((avgPrice - bestPrice) / bestPrice) * 100 : 0
  const filledPercent = amount > 0 ? (spent / amount) * 100 : 0

  return {
    output: filled,
    price_impact: priceImpact,
    avg_price: avgPrice,
    filled_percent: filledPercent,
  }
}

function jsRankQuotes(quotes: QuoteEntry[], priceImpactWeight: number): RankedQuote[] {
  if (quotes.length === 0) return []

  const maxOutput = Math.max(...quotes.map((q) => q.output_amount))
  const normalizer = maxOutput > 0 ? maxOutput : 1

  const ranked: RankedQuote[] = quotes.map((q) => {
    const normalizedOutput = q.output_amount / normalizer
    const score =
      normalizedOutput -
      (priceImpactWeight * q.price_impact) / 100 -
      q.fee / normalizer -
      q.estimated_gas / normalizer

    return { ...q, score, rank: 0 }
  })

  ranked.sort((a, b) => b.score - a.score)
  ranked.forEach((entry, i) => {
    entry.rank = i + 1
  })

  return ranked
}

// ─── Public API (auto-selects WASM or JS) ────────────────────────────────────

/**
 * Simulate a market order against orderbook levels.
 * Uses WASM if loaded, otherwise pure JS.
 */
export function simulateMarketOrder(
  amount: number,
  isBuy: boolean,
  levels: OrderBookLevel[],
): SimResult {
  if (wasmModule) {
    return wasmModule.simulate_market_order(amount, isBuy, levels)
  }
  return jsSimulateMarketOrder(amount, isBuy, levels)
}

/**
 * Rank and sort quotes using weighted scoring.
 * Uses WASM if loaded, otherwise pure JS.
 */
export function rankQuotes(quotes: RouteQuote[], priceImpactWeight = 1.0): RankedQuote[] {
  const entries: QuoteEntry[] = quotes.map((q) => ({
    dex: q.dex,
    output_amount: q.outputAmount,
    price_impact: q.priceImpact,
    fee: q.fee.amount,
    estimated_gas: q.estimatedGas,
  }))

  if (wasmModule) {
    return wasmModule.rank_quotes(entries, priceImpactWeight)
  }
  return jsRankQuotes(entries, priceImpactWeight)
}
