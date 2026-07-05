import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

function randomToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Upsert Telegram user and issue a fresh session token. */
export const createTelegramSession = internalMutation({
  args: {
    telegramId: v.number(),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    username: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    languageCode: v.optional(v.string()),
    isPremium: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('telegramUsers')
      .withIndex('by_telegram_id', (q) => q.eq('telegramId', args.telegramId))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        firstName: args.firstName,
        lastName: args.lastName,
        username: args.username,
        photoUrl: args.photoUrl,
        languageCode: args.languageCode,
        isPremium: args.isPremium,
        lastSeenAt: now,
      })
    } else {
      await ctx.db.insert('telegramUsers', {
        telegramId: args.telegramId,
        firstName: args.firstName,
        lastName: args.lastName,
        username: args.username,
        photoUrl: args.photoUrl,
        languageCode: args.languageCode,
        isPremium: args.isPremium,
        lastSeenAt: now,
      })
    }

    const token = randomToken()
    const expiresAt = now + SESSION_TTL_MS
    await ctx.db.insert('telegramSessions', {
      token,
      telegramId: args.telegramId,
      createdAt: now,
      expiresAt,
    })

    return {
      token,
      expiresAt,
      user: {
        id: args.telegramId,
        firstName: args.firstName,
        lastName: args.lastName,
        username: args.username,
        photoUrl: args.photoUrl,
        languageCode: args.languageCode,
        isPremium: args.isPremium,
      },
    }
  },
})
