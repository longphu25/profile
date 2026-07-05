import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * marketSnapshots: latest cached multi-venue metrics per symbol.
 * `payload` stores the full MarketSnapshot JSON from shared/btc-chart.
 */
export default defineSchema({
  telegramUsers: defineTable({
    telegramId: v.number(),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    username: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    languageCode: v.optional(v.string()),
    isPremium: v.optional(v.boolean()),
    lastSeenAt: v.number(),
  }).index('by_telegram_id', ['telegramId']),

  telegramSessions: defineTable({
    token: v.string(),
    telegramId: v.number(),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index('by_token', ['token']),

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
