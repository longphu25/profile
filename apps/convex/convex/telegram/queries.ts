import { v } from 'convex/values'
import { query } from '../_generated/server'

/** Resolve a bearer session token to the stored Telegram user. */
export const getTelegramSession = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query('telegramSessions')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique()

    if (!session || session.expiresAt <= Date.now()) return null

    const user = await ctx.db
      .query('telegramUsers')
      .withIndex('by_telegram_id', (q) => q.eq('telegramId', session.telegramId))
      .unique()

    if (!user) return null

    return {
      expiresAt: session.expiresAt,
      user: {
        id: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        photoUrl: user.photoUrl,
        languageCode: user.languageCode,
        isPremium: user.isPremium,
      },
    }
  },
})
