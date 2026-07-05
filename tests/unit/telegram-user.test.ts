import { describe, expect, test } from 'bun:test'
import {
  displayTelegramName,
  mapRawTelegramUser,
  parseTelegramUserFromInitData,
} from '../../src/telegram-btc-alert/lib/telegram-user'

describe('telegram-user', () => {
  test('mapRawTelegramUser maps Telegram fields', () => {
    const user = mapRawTelegramUser({
      id: 99,
      first_name: 'Long',
      last_name: 'Phu',
      username: 'longphu',
      photo_url: 'https://example.com/a.jpg',
    })
    expect(user?.id).toBe(99)
    expect(displayTelegramName(user!)).toBe('Long Phu')
  })

  test('parseTelegramUserFromInitData reads user query field', () => {
    const initData = new URLSearchParams({
      auth_date: '1700000000',
      user: JSON.stringify({ id: 7, first_name: 'Test' }),
    }).toString()
    const user = parseTelegramUserFromInitData(initData)
    expect(user?.id).toBe(7)
    expect(user?.firstName).toBe('Test')
  })
})
