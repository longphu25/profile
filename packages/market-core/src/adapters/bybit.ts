import type { ExchangeMarketAdapter } from './types'
import type { ExchangeVenueSnapshot, SymbolRoutingContext } from '../lib/types'
import { fetchJson } from '../lib/utils'

/** Bybit linear perpetual public REST adapter. */
export class BybitMarketAdapter implements ExchangeMarketAdapter {
  readonly venue = 'bybit' as const

  async fetchSnapshot(ctx: SymbolRoutingContext): Promise<ExchangeVenueSnapshot | null> {
    const category = ctx.bybitCategory ?? 'linear'
    const symbol = ctx.symbol
    const base = `https://api.bybit.com/v5/market`

    const [tickerJson, fundingJson, oiJson] = await Promise.all([
      fetchJson(`${base}/tickers?category=${category}&symbol=${symbol}`),
      fetchJson(`${base}/funding/history?category=${category}&symbol=${symbol}&limit=1`),
      fetchJson(
        `${base}/open-interest?category=${category}&symbol=${symbol}&intervalTime=5min&limit=1`,
      ),
    ])

    const ticker = (tickerJson as { result?: { list?: Array<Record<string, string>> } })?.result
      ?.list?.[0]
    const funding = (fundingJson as { result?: { list?: Array<{ fundingRate?: string }> } })?.result
      ?.list?.[0]
    const oiItem = (oiJson as { result?: { list?: Array<{ openInterest?: string }> } })?.result
      ?.list?.[0]

    if (!ticker && !funding && !oiItem) return null

    const lastPrice = ticker?.lastPrice ? +ticker.lastPrice : null
    const markPrice = ticker?.markPrice ? +ticker.markPrice : lastPrice
    const priceForOi = markPrice ?? lastPrice ?? 0
    const oiQty = oiItem?.openInterest ? +oiItem.openInterest : null
    const fundingPct = funding?.fundingRate ? +funding.fundingRate * 100 : null

    return {
      venue: this.venue,
      fundingPct: Number.isFinite(fundingPct) ? fundingPct : null,
      oiUsd: oiQty != null && priceForOi > 0 ? oiQty * priceForOi : null,
      markPrice: Number.isFinite(markPrice) ? markPrice : null,
      lastPrice: Number.isFinite(lastPrice) ? lastPrice : null,
      quoteVolume24h: ticker?.turnover24h ? +ticker.turnover24h : null,
    }
  }
}
