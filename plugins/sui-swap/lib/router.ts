import type { DexAdapter, QuoteParams, RouteQuote, RouterConfig, DexId } from './types'
import { withTimeout } from './utils'
import { rankQuotes } from './wasm-bridge'
import { DeepBookAdapter } from './deepbook'
import { CetusAdapter } from './cetus'
import { TurbosAdapter } from './turbos'
import { SevenKAdapter } from './sevenk'
import { BluefinAdapter } from './bluefin'

/**
 * SwapRouter — Orchestrator using Strategy pattern.
 *
 * Open/Closed: add new DEX by registering a DexAdapter, no modification needed.
 * Single Responsibility: router only orchestrates; adapters handle fetching.
 * Dependency Inversion: depends on DexAdapter interface, not concrete classes.
 */
export class SwapRouter {
  private adapters: DexAdapter[] = []

  /** Register a new DEX adapter */
  register(adapter: DexAdapter): this {
    this.adapters.push(adapter)
    return this
  }

  /** Get all registered adapter IDs */
  getRegisteredDexes(): DexId[] {
    return this.adapters.map((a) => a.id)
  }

  /** Get adapter metadata for UI */
  getAdapterMeta(): Array<{ id: DexId; label: string; icon: string; color: string }> {
    return this.adapters.map((a) => ({
      id: a.id,
      label: a.label,
      icon: a.icon,
      color: a.color,
    }))
  }

  /** Get eligible adapters for a given pair */
  getEligibleAdapters(from: string, to: string, network: 'mainnet' | 'testnet'): DexAdapter[] {
    return this.adapters.filter((a) => a.supportsPair(from, to, network))
  }

  /**
   * Fetch quotes from all eligible adapters in parallel.
   * Uses WASM-accelerated ranking when available.
   * Returns sorted by best score (output - impact - fees).
   */
  async fetchAllQuotes(params: QuoteParams, config?: RouterConfig): Promise<RouteQuote[]> {
    const globalTimeout = config?.globalTimeout
    const enabledIds = config?.enabledDexes

    const eligible = this.adapters.filter((adapter) => {
      if (enabledIds && !enabledIds.includes(adapter.id)) return false
      return adapter.supportsPair(params.fromToken, params.toToken, params.network)
    })

    const promises = eligible.map((adapter) => {
      const timeout = globalTimeout ?? adapter.timeout
      return withTimeout(adapter.fetchQuote(params), timeout)
    })

    const results = await Promise.allSettled(promises)

    const quotes = results
      .filter((r): r is PromiseFulfilledResult<RouteQuote> => r.status === 'fulfilled')
      .map((r) => r.value)

    if (quotes.length === 0) return []

    // Use WASM-accelerated ranking (weighted score) or simple sort fallback
    const ranked = rankQuotes(quotes, 1.0)
    const sortedDexOrder = ranked.map((r) => r.dex)

    return quotes.sort((a, b) => {
      const aIdx = sortedDexOrder.indexOf(a.dex)
      const bIdx = sortedDexOrder.indexOf(b.dex)
      return aIdx - bIdx
    })
  }
}

/**
 * Default router instance with all built-in adapters registered.
 * Singleton — import and use directly.
 */
export const defaultRouter = new SwapRouter()
  .register(new DeepBookAdapter())
  .register(new CetusAdapter())
  .register(new TurbosAdapter())
  .register(new SevenKAdapter())
  .register(new BluefinAdapter())

/** Convenience: get best quote from sorted list */
export function getBestQuote(quotes: RouteQuote[]): RouteQuote | null {
  return quotes[0] ?? null
}

/** Calculate savings between best and worst route */
export function getSavingsPercent(quotes: RouteQuote[]): number {
  if (quotes.length < 2) return 0
  const best = quotes[0].outputAmount
  const worst = quotes[quotes.length - 1].outputAmount
  if (worst <= 0) return 0
  return ((best - worst) / worst) * 100
}
