import type { DexAdapter, QuoteParams, RouteQuote } from './types'
import { getCached, setCache, cacheKey } from './utils'

const SEVK_QUOTE_API = 'https://api.7k.ag/v1/swap/quote'

/** Coin type registry */
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
 * 7k Aggregator adapter — meta-aggregator across all Sui DEXes.
 * Provides split routing and multi-hop optimization.
 */
export class SevenKAdapter implements DexAdapter {
  readonly id = 'sevenk' as 'deepbook' | 'cetus' | 'turbos'
  readonly label = '7k Aggregator'
  readonly icon = '🔀'
  readonly color = '#a78bfa'
  readonly timeout = 4000

  supportsPair(from: string, to: string): boolean {
    return from in COIN_TYPES && to in COIN_TYPES && from !== to
  }

  async fetchQuote(params: QuoteParams): Promise<RouteQuote> {
    const { fromToken, toToken, amount, slippage } = params
    const key = cacheKey(fromToken, toToken, amount, 'sevenk')
    const cached = getCached<RouteQuote>(key)
    if (cached) return cached

    const fromType = resolveCoinType(fromToken)
    const toType = resolveCoinType(toToken)
    const fromDecimals = resolveDecimals(fromToken)
    const rawAmount = BigInt(Math.floor(amount * 10 ** fromDecimals))

    const url = new URL(SEVK_QUOTE_API)
    url.searchParams.set('tokenIn', fromType)
    url.searchParams.set('tokenOut', toType)
    url.searchParams.set('amountIn', rawAmount.toString())
    url.searchParams.set('slippage', slippage.toString())

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`7k API: ${res.status}`)

    const data = await res.json()
    if (!data.amountOut) throw new Error('No 7k route found')

    const toDecimals = resolveDecimals(toToken)
    const outputAmount = Number(BigInt(data.amountOut)) / 10 ** toDecimals
    const priceImpact = Number(data.priceImpact || 0) * 100

    const routeHops = (data.routes || []).map(
      (r: { dex: string; tokenIn: string; tokenOut: string }) =>
        `${r.dex}: ${r.tokenIn.split('::').pop()} → ${r.tokenOut.split('::').pop()}`,
    )

    const quote: RouteQuote = {
      dex: this.id,
      dexLabel: this.label,
      outputAmount,
      priceImpact,
      fee: { amount: 0, token: toToken },
      route: routeHops.length > 0 ? routeHops : [fromToken, toToken],
      estimatedGas: 0.005,
      serializedTx: data.txData || undefined,
    }

    setCache(key, quote)
    return quote
  }
}
