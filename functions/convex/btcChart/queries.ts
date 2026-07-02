import { v } from 'convex/values'
import { query } from '../_generated/server'
import { docToSnapshot } from './mappers'

/** Latest cached market snapshot for a symbol (read-only, no exchange fetch). */
export const getLatestMarketSnapshot = query({
  args: { symbol: v.string() },
  handler: async (ctx, { symbol }) => {
    const doc = await ctx.db
      .query('marketSnapshots')
      .withIndex('by_symbol', (q) => q.eq('symbol', symbol.toUpperCase()))
      .order('desc')
      .first()

    if (!doc) return null
    return docToSnapshot(doc)
  },
})
