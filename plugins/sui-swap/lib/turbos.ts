import type { DexAdapter, QuoteParams, RouteQuote } from './types'
import { getCached, setCache, cacheKey } from './utils'

const TURBOS_API = 'https://api.turbos.finance/route/get-quote'

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
 * Turbos AMM adapter — concentrated liquidity swap via Turbos API.
 * Single Responsibility: only handles Turbos quote fetching.
 */
export class TurbosAdapter implements DexAdapter {
  readonly id = 'turbos' as const
  readonly label = 'Turbos AMM'
  readonly icon = '⚡'
  readonly color = '#f5a623'
  readonly timeout = 2500

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

    const res = await fetch(TURBOS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_in: fromType,
        token_out: toType,
        amount_in: rawAmount.toString(),
      }),
    })

    if (!res.ok) throw new Error(`Turbos API: ${res.status}`)

    const data = await res.json()
    if (!data.amount_out) throw new Error('No Turbos route found')

    const toDecimals = resolveDecimals(toToken)
    const outputAmount = Number(BigInt(data.amount_out)) / 10 ** toDecimals
    const priceImpact = Number(data.price_impact || 0) * 100

    const quote: RouteQuote = {
      dex: this.id,
      dexLabel: this.label,
      outputAmount,
      priceImpact,
      fee: { amount: outputAmount * 0.002, token: toToken },
      route: data.route_path || [fromToken, toToken],
      estimatedGas: 0.004,
      serializedTx: data.tx_data || undefined,
    }

    setCache(key, quote)
    return quote
  }
}
