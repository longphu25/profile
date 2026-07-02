import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
/** Upsert latest market snapshot for a symbol (called from actions after ingest). */
export const upsertMarketSnapshot = internalMutation({
  args: {
    payload: v.string(),
    symbol: v.string(),
    ts: v.number(),
    fundingAvg: v.number(),
    oiTotalUsd: v.number(),
    markMedian: v.number(),
    markSpreadPct: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('marketSnapshots')
      .withIndex('by_symbol', (q) => q.eq('symbol', args.symbol))
      .order('desc')
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        ts: args.ts,
        fundingAvg: args.fundingAvg,
        oiTotalUsd: args.oiTotalUsd,
        markMedian: args.markMedian,
        markSpreadPct: args.markSpreadPct,
        payload: args.payload,
      })
      return existing._id
    }

    return ctx.db.insert('marketSnapshots', {
      symbol: args.symbol,
      ts: args.ts,
      fundingAvg: args.fundingAvg,
      oiTotalUsd: args.oiTotalUsd,
      markMedian: args.markMedian,
      markSpreadPct: args.markSpreadPct,
      payload: args.payload,
    })
  },
})
