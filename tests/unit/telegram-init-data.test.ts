import { describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import { validateTelegramInitData } from '../../apps/convex/convex/telegram/validateInitData'

function buildInitData(botToken: string, fields: Record<string, string>): string {
  const pairs = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b))
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  const params = new URLSearchParams(fields)
  params.set('hash', hash)
  return params.toString()
}

describe('validateTelegramInitData', () => {
  test('accepts a valid HMAC signature', async () => {
    const botToken = '123456:ABC-DEF'
    const authDate = String(Math.floor(Date.now() / 1000))
    const initData = buildInitData(botToken, {
      auth_date: authDate,
      user: JSON.stringify({ id: 42, first_name: 'Long', username: 'longphu' }),
    })

    const parsed = await validateTelegramInitData(initData, botToken)
    expect(parsed).not.toBeNull()
    expect(parsed?.user.id).toBe(42)
    expect(parsed?.user.first_name).toBe('Long')
  })

  test('rejects tampered hash', async () => {
    const botToken = '123456:ABC-DEF'
    const authDate = String(Math.floor(Date.now() / 1000))
    const initData = buildInitData(botToken, {
      auth_date: authDate,
      user: JSON.stringify({ id: 1, first_name: 'A' }),
    })

    const tampered = initData.replace('first_name', 'first_namex')
    const parsed = await validateTelegramInitData(tampered, botToken)
    expect(parsed).toBeNull()
  })
})
