import type { DexAdapter, QuoteParams, RouteQuote } from './types'
import { getCached, setCache, cacheKey } from './utils'

const BLUEFIN_QUOTE_API = 'https://swap-api.bluefin.io/api/v1/quote'

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
 * Bluefin Swap adapter — concentrated liquidity AMM.
 * Deep liquidity for major pairs (SUI, BTC, ETH).
 */
export class BluefinAdapter implements DexAdapter {
  readonly id = 'bluefin' as 'deepbook' | 'cetus' | 'turbos'
  readonly label = 'Bluefin'
  readonly icon = '🐬'
  readonly color = '#3b82f6'
  readonly timeout = 3000

  supportsPair(from: string, to: string): boolean {
    return from in COIN_TYPES && to in COIN_TYPES && from !== to
  }

  async fetchQuote(params: QuoteParams): Promise<RouteQuote> {
    const { fromToken, toToken, amount, slippage, sender } = params
    const key = cacheKey(fromToken, toToken, amount, 'bluefin')
    const cached = getCached<RouteQuote>(key)
    if (cached) return cached

    const fromType = resolveCoinType(fromToken)
    const toType = resolveCoinType(toToken)
    const fromDecimals = resolveDecimals(fromToken)
    const rawAmount = BigInt(Math.floor(amount * 10 ** fromDecimals))
    const slippageBps = Math.round(slippage * 10000)

    const res = await fetch(BLUEFIN_QUOTE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenIn: fromType,
        tokenOut: toType,
        amountIn: rawAmount.toString(),
        slippage: slippageBps,
        sender: sender || undefined,
      }),
    })

    if (!res.ok) throw new Error(`Bluefin API: ${res.status}`)

    const data = await res.json()
    if (!data.amountOut) throw new Error('No Bluefin route found')

    const toDecimals = resolveDecimals(toToken)
    const outputAmount = Number(BigInt(data.amountOut)) / 10 ** toDecimals
    const priceImpact = Number(data.priceImpact || 0) * 100

    const routeHops = (data.route || []).map(
      (r: { pool: string; tokenIn: string; tokenOut: string }) =>
        `${r.tokenIn.split('::').pop()} → ${r.tokenOut.split('::').pop()}`,
    )

    const quote: RouteQuote = {
      dex: this.id,
      dexLabel: this.label,
      outputAmount,
      priceImpact,
      fee: { amount: Number(data.fee || 0) / 10 ** toDecimals, token: toToken },
      route: routeHops.length > 0 ? routeHops : [fromToken, toToken],
      estimatedGas: 0.004,
      serializedTx: data.txPayload || undefined,
    }

    setCache(key, quote)
    return quote
  }
}
