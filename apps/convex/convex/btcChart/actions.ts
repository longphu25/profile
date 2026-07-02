import { v } from 'convex/values'
import { internal } from '../_generated/api'
import { internalAction } from '../_generated/server'
import { DEFAULT_CRON_SYMBOLS, type SymbolRoutingContext } from '@profile/market-core'
import { getMarketSnapshotOrchestrator } from './orchestrator'
import { snapshotToDoc } from './mappers'

const routingArgs = {
  symbol: v.string(),
  okxInstId: v.optional(v.string()),
  mexcSymbol: v.optional(v.string()),
  bybitCategory: v.optional(v.string()),
}

/** Fetch all venues for one symbol and persist snapshot. */
export const refreshMarketSnapshot = internalAction({
  args: routingArgs,
  handler: async (ctx, args) => {
    const routing: SymbolRoutingContext = {
      symbol: args.symbol.toUpperCase(),
      okxInstId: args.okxInstId,
      mexcSymbol: args.mexcSymbol,
      bybitCategory: args.bybitCategory,
    }

    const snapshot = await getMarketSnapshotOrchestrator().collect(routing)
    const doc = snapshotToDoc(snapshot)

    await ctx.runMutation(internal.btcChart.mutations.upsertMarketSnapshot, {
      symbol: doc.symbol,
      ts: doc.ts,
      fundingAvg: doc.fundingAvg,
      oiTotalUsd: doc.oiTotalUsd,
      markMedian: doc.markMedian,
      markSpreadPct: doc.markSpreadPct,
      payload: doc.payload,
    })

    return { symbol: doc.symbol, ts: doc.ts }
  },
})

/** Batch refresh for cron: default symbol list from shared config. */
export const refreshDefaultSymbols = internalAction({
  args: {},
  handler: async (ctx) => {
    const results: { symbol: string; ok: boolean }[] = []

    for (const routing of DEFAULT_CRON_SYMBOLS) {
      try {
        await ctx.runAction(internal.btcChart.actions.refreshMarketSnapshot, {
          symbol: routing.symbol,
          okxInstId: routing.okxInstId,
          mexcSymbol: routing.mexcSymbol,
          bybitCategory: routing.bybitCategory,
        })
        results.push({ symbol: routing.symbol, ok: true })
      } catch {
        results.push({ symbol: routing.symbol, ok: false })
      }
    }

    return results
  },
})
