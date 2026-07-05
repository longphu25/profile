/** Validate Telegram Mini App initData per official WebApp HMAC rules. */

export interface ParsedTelegramInitData {
  readonly authDate: number
  readonly user: Record<string, unknown>
  readonly startParam?: string
}

const MAX_AUTH_AGE_SEC = 86_400

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function keyBytes(key: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(key.byteLength)
  copy.set(key)
  return copy.buffer
}

async function hmacSha256(key: Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Returns parsed init data when the HMAC hash matches the bot token. */
export async function validateTelegramInitData(
  initData: string,
  botToken: string,
): Promise<ParsedTelegramInitData | null> {
  if (!initData.trim() || !botToken.trim()) return null

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null

  const pairs: string[] = []
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue
    pairs.push(`${key}=${value}`)
  }
  pairs.sort()
  const dataCheckString = pairs.join('\n')

  const webAppKeyBytes = new Uint8Array(
    await hmacSha256(new TextEncoder().encode('WebAppData'), botToken),
  )
  const calculated = toHex(await hmacSha256(webAppKeyBytes, dataCheckString))
  if (!timingSafeEqual(calculated, hash)) return null

  const authDateRaw = params.get('auth_date')
  const authDate = authDateRaw ? Number(authDateRaw) : NaN
  if (!Number.isFinite(authDate)) return null
  const ageSec = Math.floor(Date.now() / 1000) - authDate
  if (ageSec < 0 || ageSec > MAX_AUTH_AGE_SEC) return null

  const userRaw = params.get('user')
  if (!userRaw) return null
  let user: Record<string, unknown>
  try {
    user = JSON.parse(userRaw) as Record<string, unknown>
  } catch {
    return null
  }

  const startParam = params.get('start_param') ?? undefined
  return { authDate, user, startParam }
}
