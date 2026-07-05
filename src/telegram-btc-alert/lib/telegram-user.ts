/** Telegram Mini App user identity (from validated initData or initDataUnsafe). */

export interface TelegramUser {
  readonly id: number
  readonly firstName: string
  readonly lastName?: string
  readonly username?: string
  readonly languageCode?: string
  readonly photoUrl?: string
  readonly isPremium?: boolean
}

export interface TelegramAuthSession {
  readonly token: string
  readonly user: TelegramUser
  /** True when initData was verified server-side with the bot token. */
  readonly verified: boolean
  readonly expiresAt: number
}

export type TelegramAuthStatus = 'loading' | 'authenticated' | 'guest'

export interface TelegramAuthState {
  readonly status: TelegramAuthStatus
  readonly user: TelegramUser | null
  readonly verified: boolean
  readonly error: string | null
}

const SESSION_STORAGE_KEY = 'tga_telegram_session'

/** Parse the JSON `user` field from a Telegram initData query string. */
export function parseTelegramUserFromInitData(initData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData)
    const raw = params.get('user')
    if (!raw) return null
    return mapRawTelegramUser(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    return null
  }
}

/** Map Telegram WebApp user object to a stable app shape. */
export function mapRawTelegramUser(raw: Record<string, unknown>): TelegramUser | null {
  const id = typeof raw.id === 'number' ? raw.id : Number(raw.id)
  if (!Number.isFinite(id)) return null
  const firstName = typeof raw.first_name === 'string' ? raw.first_name : ''
  if (!firstName) return null
  return {
    id,
    firstName,
    lastName: typeof raw.last_name === 'string' ? raw.last_name : undefined,
    username: typeof raw.username === 'string' ? raw.username : undefined,
    languageCode: typeof raw.language_code === 'string' ? raw.language_code : undefined,
    photoUrl: typeof raw.photo_url === 'string' ? raw.photo_url : undefined,
    isPremium: raw.is_premium === true,
  }
}

export function displayTelegramName(user: TelegramUser): string {
  const last = user.lastName ? ` ${user.lastName}` : ''
  return `${user.firstName}${last}`.trim()
}

export function loadStoredTelegramSession(): TelegramAuthSession | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TelegramAuthSession
    if (!parsed?.token || !parsed?.user?.id) return null
    if (parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveTelegramSession(session: TelegramAuthSession): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function clearTelegramSession(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(SESSION_STORAGE_KEY)
}
