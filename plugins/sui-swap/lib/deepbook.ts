import type { DexAdapter, QuoteParams, RouteQuote } from './types'
import { getCached, setCache, cacheKey } from './utils'
import { simulateMarketOrder } from './wasm-bridge'

const INDEXER: Record<string, string> = {
  mainnet: 'https://deepbook-indexer.mainnet.mystenlabs.com',
  testnet: 'https://deepbook-indexer.testnet.mystenlabs.com',
}

/** Known DeepBook pools by network */
const POOLS: Record<string, string[]> = {
  mainnet: [
    'DEEP_SUI',
    'SUI_USDC',
    'DEEP_USDC',
    'WAL_USDC',
    'WAL_SUI',
    'XBTC_USDC',
    'USDT_USDC',
    'BETH_USDC',
    'NS_USDC',
    'NS_SUI',
  ],
  testnet: [
    'DEEP_SUI',
    'SUI_DBUSDC',
    'DEEP_DBUSDC',
    'WAL_DBUSDC',
    'WAL_SUI',
    'DBTC_DBUSDC',
    'DBUSDT_DBUSDC',
  ],
}

/** Resolve pool name for a token pair */
function resolvePool(
  from: string,
  to: string,
  network: string,
): { poolName: string; isBuy: boolean } | null {
  const pools = POOLS[network] || []
  const forward = `${from}_${to}`
  const reverse = `${to}_${from}`
  if (pools.includes(forward)) return { poolName: forward, isBuy: false }
  if (pools.includes(reverse)) return { poolName: reverse, isBuy: true }
  return null
}

/**
 * DeepBook v3 adapter — CLOB-based swap via orderbook simulation.
 * Uses WASM-accelerated simulateMarketOrder when available.
 */
export class DeepBookAdapter implements DexAdapter {
  readonly id = 'deepbook' as const
  readonly label = 'DeepBook v3'
  readonly icon = '📊'
  readonly color = '#80ffd5'
  readonly timeout = 3000

  supportsPair(from: string, to: string, network: 'mainnet' | 'testnet'): boolean {
    return resolvePool(from, to, network) !== null
  }

  async fetchQuote(params: QuoteParams): Promise<RouteQuote> {
    const { fromToken, toToken, amount, network } = params
    const key = cacheKey(fromToken, toToken, amount, this.id)
    const cached = getCached<RouteQuote>(key)
    if (cached) return cached

    const resolved = resolvePool(fromToken, toToken, network)
    if (!resolved) throw new Error('No DeepBook pool for this pair')

    const { poolName, isBuy } = resolved
    const base = INDEXER[network]
    const res = await fetch(`${base}/orderbook/${poolName}`)
    if (!res.ok) throw new Error(`DeepBook indexer: ${res.status}`)

    const data = await res.json()
    const rawLevels = isBuy ? data.asks : data.bids
    const levels = (rawLevels || []).map(([p, s]: [string, string]) => ({
      price: Number(p),
      size: Number(s),
    }))

    // WASM-accelerated or JS fallback
    const sim = simulateMarketOrder(amount, isBuy, levels)
    if (sim.output <= 0) throw new Error('Insufficient DeepBook liquidity')

    const quote: RouteQuote = {
      dex: this.id,
      dexLabel: this.label,
      outputAmount: sim.output,
      priceImpact: sim.price_impact,
      fee: { amount: 0, token: 'DEEP' },
      route: [fromToken, toToken],
      estimatedGas: 0.003,
    }

    setCache(key, quote)
    return quote
  }
}
