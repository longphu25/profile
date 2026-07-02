import type { ExchangeMarketAdapter } from './types'
import type { ExchangeVenueSnapshot, SymbolRoutingContext } from '../lib/types'
import { fetchJson } from '../lib/utils'

function defaultMexcSymbol(symbol: string): string {
  return symbol.replace(/USDT$/i, '_USDT')
}

/** MEXC USDT perpetual contract public REST adapter. */
export class MexcMarketAdapter implements ExchangeMarketAdapter {
  readonly venue = 'mexc' as const

  async fetchSnapshot(ctx: SymbolRoutingContext): Promise<ExchangeVenueSnapshot | null> {
    const msym = ctx.mexcSymbol ?? defaultMexcSymbol(ctx.symbol)
    const json = await fetchJson(`https://contract.mexc.com/api/v1/contract/ticker?symbol=${msym}`)
    const t = (json as { data?: Record<string, string | number> })?.data
    if (!t) return null

    const lastPrice = t.lastPrice != null ? +t.lastPrice : null
    const holdVol = t.holdVol != null ? +t.holdVol : null
    const fundingPct = t.fundingRate != null ? +t.fundingRate * 100 : null
    const oiUsd = holdVol != null && lastPrice != null && lastPrice > 0 ? holdVol * lastPrice : null

    return {
      venue: this.venue,
      fundingPct: Number.isFinite(fundingPct) ? fundingPct : null,
      oiUsd: Number.isFinite(oiUsd) ? oiUsd : null,
      markPrice: Number.isFinite(lastPrice) ? lastPrice : null,
      lastPrice: Number.isFinite(lastPrice) ? lastPrice : null,
      quoteVolume24h: t.amount24 != null ? +t.amount24 : null,
    }
  }
}
