import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * marketSnapshots: latest cached multi-venue metrics per symbol.
 * `payload` stores the full MarketSnapshot JSON from shared/btc-chart.
 */
export default defineSchema({
  marketSnapshots: defineTable({
    symbol: v.string(),
    ts: v.number(),
    fundingAvg: v.number(),
    oiTotalUsd: v.number(),
    markMedian: v.number(),
    markSpreadPct: v.number(),
    payload: v.string(),
  })
    .index('by_symbol', ['symbol'])
    .index('by_symbol_ts', ['symbol', 'ts']),
})
