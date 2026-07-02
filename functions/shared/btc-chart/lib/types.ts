/** Domain types for multi-venue btc-chart market snapshots (Convex backend). */

export type VenueId = 'binance' | 'bybit' | 'okx' | 'mexc'

/** Routing hints for symbols that differ per exchange. */
export interface SymbolRoutingContext {
  readonly symbol: string
  readonly okxInstId?: string
  readonly mexcSymbol?: string
  readonly bybitCategory?: string
}

/** Partial metrics returned by a single exchange adapter. */
export interface ExchangeVenueSnapshot {
  readonly venue: VenueId
  readonly fundingPct: number | null
  readonly oiUsd: number | null
  readonly markPrice: number | null
  readonly lastPrice: number | null
  readonly quoteVolume24h: number | null
}

export interface FundingAggregate {
  readonly binance?: number
  readonly bybit?: number
  readonly okx?: number
  readonly mexc?: number
  readonly avg: number
  readonly spread: number
}

export interface OiUsdAggregate {
  readonly binance?: number
  readonly bybit?: number
  readonly okx?: number
  readonly mexc?: number
  readonly total: number
}

export interface MarkAggregate {
  readonly binance?: number
  readonly bybit?: number
  readonly okx?: number
  readonly mexc?: number
  readonly median: number
  readonly spreadPct: number
}

export interface Volume24hAggregate {
  readonly binance?: number
  readonly bybit?: number
  readonly okx?: number
  readonly mexc?: number
}

export interface SnapshotMeta {
  readonly venuesReporting: readonly VenueId[]
  readonly trendSource: 'aggregated'
}

/** Normalized multi-venue snapshot stored in Convex and served over HTTP. */
export interface MarketSnapshot {
  readonly symbol: string
  readonly ts: number
  readonly funding: FundingAggregate
  readonly oiUsd: OiUsdAggregate
  readonly mark: MarkAggregate
  readonly volume24hQuote: Volume24hAggregate
  readonly meta: SnapshotMeta
}
