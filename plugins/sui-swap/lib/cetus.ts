import type { DexAdapter, QuoteParams, RouteQuote } from './types'
import { getCached, setCache, cacheKey } from './utils'

const CETUS_API = 'https://api-sui.cetus.zone/router_v2/find_routes'

/** Coin type registry — maps symbols to on-chain type strings */
const COIN_TYPES: Record<string, string> = {
  SUI: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
  USDC: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
  DEEP: '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP',
  WAL: '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL',
  USDT: '0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT',
}

const DECIMALS: Record<string, number> = {
  SUI: 9,
  USDC: 6,
  DEEP: 6,
  WAL: 9,
  USDT: 6,
}

function resolveCoinType(symbol: string): string {
  return COIN_TYPES[symbol] || symbol
}

function resolveDecimals(symbol: string): number {
  return DECIMALS[symbol] || 9
}

/**
 * Cetus AMM adapter — concentrated liquidity swap via Cetus aggregator API.
 * Single Responsibility: only handles Cetus quote fetching.
 */
export class CetusAdapter implements DexAdapter {
  readonly id = 'cetus' as const
  readonly label = 'Cetus AMM'
  readonly icon = '🐋'
  readonly color = '#6fbcf0'
  readonly timeout = 3000

  supportsPair(from: string, to: string): boolean {
    return from in COIN_TYPES && to in COIN_TYPES
  }

  async fetchQuote(params: QuoteParams): Promise<RouteQuote> {
    const { fromToken, toToken, amount } = params
    const key = cacheKey(fromToken, toToken, amount, this.id)
    const cached = getCached<RouteQuote>(key)
    if (cached) return cached

    const fromType = resolveCoinType(fromToken)
    const toType = resolveCoinType(toToken)
    const fromDecimals = resolveDecimals(fromToken)
    const rawAmount = BigInt(Math.floor(amount * 10 ** fromDecimals))

    const url = new URL(CETUS_API)
    url.searchParams.set('from', fromType)
    url.searchParams.set('target', toType)
    url.searchParams.set('amount', rawAmount.toString())
    url.searchParams.set('by_amount_in', 'true')

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Cetus API: ${res.status}`)

    const data = await res.json()
    if (!data.data?.routes?.length) throw new Error('No Cetus route found')

    const bestRoute = data.data.routes[0]
    const toDecimals = resolveDecimals(toToken)
    const outputAmount = Number(BigInt(bestRoute.amount_out || '0')) / 10 ** toDecimals
    const priceImpact = Number(bestRoute.price_impact || 0) * 100

    const hops = (bestRoute.path || []).map(
      (p: { from: string; target: string }) =>
        `${p.from.split('::').pop()} → ${p.target.split('::').pop()}`,
    )

    const quote: RouteQuote = {
      dex: this.id,
      dexLabel: this.label,
      outputAmount,
      priceImpact,
      fee: { amount: outputAmount * 0.003, token: toToken },
      route: hops.length > 0 ? hops : [fromToken, toToken],
      estimatedGas: 0.005,
      serializedTx: bestRoute.tx_data || undefined,
    }

    setCache(key, quote)
    return quote
  }
}
