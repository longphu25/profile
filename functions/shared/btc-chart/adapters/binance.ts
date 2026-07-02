import type { ExchangeMarketAdapter } from './types'
import type { ExchangeVenueSnapshot, SymbolRoutingContext } from '../lib/types'
import { fetchJson } from '../lib/utils'

interface PremiumIndex {
  lastFundingRate?: string
  markPrice?: string
  indexPrice?: string
}

interface OpenInterest {
  openInterest?: string
}

interface Ticker24h {
  lastPrice?: string
  quoteVolume?: string
}

/** Binance USDT-M futures public REST adapter. */
export class BinanceMarketAdapter implements ExchangeMarketAdapter {
  readonly venue = 'binance' as const

  async fetchSnapshot(ctx: SymbolRoutingContext): Promise<ExchangeVenueSnapshot | null> {
    const symbol = ctx.symbol
    const [premium, oiRow, ticker] = await Promise.all([
      fetchJson(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`),
      fetchJson(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`),
      fetchJson(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`),
    ])

    const premiumData = premium as PremiumIndex | null
    const oiData = oiRow as OpenInterest | null
    const tickerData = ticker as Ticker24h | null
    if (!premiumData && !oiData && !tickerData) return null

    const markPrice = premiumData?.markPrice ? +premiumData.markPrice : null
    const lastPrice = tickerData?.lastPrice ? +tickerData.lastPrice : markPrice
    const priceForOi = markPrice ?? lastPrice ?? 0
    const oiQty = oiData?.openInterest ? +oiData.openInterest : null
    const fundingPct = premiumData?.lastFundingRate ? +premiumData.lastFundingRate * 100 : null

    return {
      venue: this.venue,
      fundingPct: Number.isFinite(fundingPct) ? fundingPct : null,
      oiUsd: oiQty != null && priceForOi > 0 ? oiQty * priceForOi : null,
      markPrice: Number.isFinite(markPrice) ? markPrice : null,
      lastPrice: Number.isFinite(lastPrice) ? lastPrice : null,
      quoteVolume24h: tickerData?.quoteVolume ? +tickerData.quoteVolume : null,
    }
  }
}
