import type {
  ExchangeVenueSnapshot,
  FundingAggregate,
  MarkAggregate,
  MarketSnapshot,
  OiUsdAggregate,
  SnapshotMeta,
  VenueId,
  Volume24hAggregate,
} from './types'
import { average, median, spread, spreadPctFromPrices } from './utils'

function venueFields(
  venues: readonly ExchangeVenueSnapshot[],
  pick: (v: ExchangeVenueSnapshot) => number | null,
): Partial<Record<VenueId, number>> {
  const out: Partial<Record<VenueId, number>> = {}
  for (const v of venues) {
    const val = pick(v)
    if (val != null && Number.isFinite(val)) {
      out[v.venue] = val
    }
  }
  return out
}

function buildFunding(venues: readonly ExchangeVenueSnapshot[]): FundingAggregate {
  const rates = venues
    .map((v) => v.fundingPct)
    .filter((r): r is number => r != null && Number.isFinite(r))
  const fields = venueFields(venues, (v) => v.fundingPct)
  const avg = average(rates) ?? 0
  return { ...fields, avg, spread: spread(rates) }
}

function buildOiUsd(venues: readonly ExchangeVenueSnapshot[]): OiUsdAggregate {
  const fields = venueFields(venues, (v) => v.oiUsd)
  const total = venues
    .map((v) => v.oiUsd)
    .filter((x): x is number => x != null && Number.isFinite(x))
    .reduce((s, x) => s + x, 0)
  return { ...fields, total }
}

function buildMark(venues: readonly ExchangeVenueSnapshot[]): MarkAggregate {
  const prices = venues
    .map((v) => v.markPrice ?? v.lastPrice)
    .filter((p): p is number => p != null && Number.isFinite(p))
  const fields = venueFields(venues, (v) => v.markPrice ?? v.lastPrice)
  return {
    ...fields,
    median: median(prices),
    spreadPct: spreadPctFromPrices(prices),
  }
}

function buildVolume(venues: readonly ExchangeVenueSnapshot[]): Volume24hAggregate {
  return venueFields(venues, (v) => v.quoteVolume24h)
}

function buildMeta(venues: readonly ExchangeVenueSnapshot[]): SnapshotMeta {
  return {
    venuesReporting: venues.map((v) => v.venue),
    trendSource: 'aggregated',
  }
}

/**
 * Pure aggregate: merge per-venue snapshots into a single MarketSnapshot (SRP).
 */
export function buildMarketSnapshot(
  symbol: string,
  ts: number,
  venueSnapshots: readonly ExchangeVenueSnapshot[],
): MarketSnapshot {
  const reporting = venueSnapshots.filter(
    (v) =>
      v.fundingPct != null ||
      v.oiUsd != null ||
      v.markPrice != null ||
      v.lastPrice != null ||
      v.quoteVolume24h != null,
  )

  return {
    symbol,
    ts,
    funding: buildFunding(reporting),
    oiUsd: buildOiUsd(reporting),
    mark: buildMark(reporting),
    volume24hQuote: buildVolume(reporting),
    meta: buildMeta(reporting),
  }
}
