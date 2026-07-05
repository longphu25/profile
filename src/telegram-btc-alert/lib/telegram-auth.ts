import type { TelegramAuthSession, TelegramUser } from './telegram-user'
import { saveTelegramSession } from './telegram-user'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

function resolveAuthBaseUrl(): string | null {
  const raw = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined
  if (!raw) return null
  return raw.replace(/\/$/, '')
}

/** Build a local (unverified) session from Telegram initDataUnsafe for instant UX. */
export function buildLocalTelegramSession(user: TelegramUser): TelegramAuthSession {
  return {
    token: `local:${user.id}`,
    user,
    verified: false,
    expiresAt: Date.now() + SESSION_TTL_MS,
  }
}

/**
 * Exchange Telegram initData for a server-verified session.
 * Returns null when the auth API is unavailable or validation fails.
 */
export async function authenticateTelegramInitData(
  initData: string,
): Promise<TelegramAuthSession | null> {
  const base = resolveAuthBaseUrl()
  if (!base) return null

  const res = await fetch(`${base}/telegram/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  })

  if (!res.ok) return null

  const body = (await res.json()) as {
    token?: string
    user?: TelegramUser
    verified?: boolean
    expiresAt?: number
  }

  if (!body.token || !body.user?.id) return null

  const session: TelegramAuthSession = {
    token: body.token,
    user: body.user,
    verified: body.verified === true,
    expiresAt: typeof body.expiresAt === 'number' ? body.expiresAt : Date.now() + SESSION_TTL_MS,
  }

  saveTelegramSession(session)
  return session
}
