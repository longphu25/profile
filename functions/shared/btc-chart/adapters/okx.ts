import type { ExchangeMarketAdapter } from './types'
import type { ExchangeVenueSnapshot, SymbolRoutingContext } from '../lib/types'
import { fetchJson } from '../lib/utils'

function defaultOkxInstId(symbol: string): string {
  const base = symbol.replace(/USDT$/i, '')
  return `${base}-USDT-SWAP`
}

/** OKX SWAP public REST adapter. */
export class OkxMarketAdapter implements ExchangeMarketAdapter {
  readonly venue = 'okx' as const

  async fetchSnapshot(ctx: SymbolRoutingContext): Promise<ExchangeVenueSnapshot | null> {
    const instId = ctx.okxInstId ?? defaultOkxInstId(ctx.symbol)
    const base = 'https://www.okx.com/api/v5'

    const [tickerJson, fundingJson, oiJson, markJson] = await Promise.all([
      fetchJson(`${base}/market/ticker?instId=${instId}`),
      fetchJson(`${base}/public/funding-rate?instId=${instId}`),
      fetchJson(`${base}/public/open-interest?instType=SWAP&instId=${instId}`),
      fetchJson(`${base}/public/mark-price?instType=SWAP&instId=${instId}`),
    ])

    const ticker = (tickerJson as { data?: Array<Record<string, string>> })?.data?.[0]
    const funding = (fundingJson as { data?: Array<{ fundingRate?: string }> })?.data?.[0]
    const oi = (oiJson as { data?: Array<{ oiCcy?: string }> })?.data?.[0]
    const mark = (markJson as { data?: Array<{ markPx?: string }> })?.data?.[0]

    if (!ticker && !funding && !oi && !mark) return null

    const lastPrice = ticker?.last ? +ticker.last : null
    const markPrice = mark?.markPx ? +mark.markPx : lastPrice
    const fundingPct = funding?.fundingRate ? +funding.fundingRate * 100 : null
    const oiUsd = oi?.oiCcy ? +oi.oiCcy : null

    return {
      venue: this.venue,
      fundingPct: Number.isFinite(fundingPct) ? fundingPct : null,
      oiUsd: Number.isFinite(oiUsd) ? oiUsd : null,
      markPrice: Number.isFinite(markPrice) ? markPrice : null,
      lastPrice: Number.isFinite(lastPrice) ? lastPrice : null,
      quoteVolume24h: ticker?.volCcy24h ? +ticker.volCcy24h : null,
    }
  }
}
