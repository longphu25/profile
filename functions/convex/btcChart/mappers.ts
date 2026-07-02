import type { MarketSnapshot } from '../../shared/btc-chart/lib/types'

export interface MarketSnapshotDoc {
  symbol: string
  ts: number
  fundingAvg: number
  oiTotalUsd: number
  markMedian: number
  markSpreadPct: number
  payload: string
}

/** Map domain snapshot to Convex document shape. */
export function snapshotToDoc(snapshot: MarketSnapshot): MarketSnapshotDoc {
  return {
    symbol: snapshot.symbol,
    ts: snapshot.ts,
    fundingAvg: snapshot.funding.avg,
    oiTotalUsd: snapshot.oiUsd.total,
    markMedian: snapshot.mark.median,
    markSpreadPct: snapshot.mark.spreadPct,
    payload: JSON.stringify(snapshot),
  }
}

/** Parse stored payload back to domain type. */
export function docToSnapshot(doc: MarketSnapshotDoc): MarketSnapshot {
  return JSON.parse(doc.payload) as MarketSnapshot
}
