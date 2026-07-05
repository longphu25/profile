#!/usr/bin/env bun
/**
 * Minimal Telegram bot: /start opens the BTC Chart Alert Mini App.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN   (required)
 *   TELEGRAM_WEBAPP_URL  (default: GitHub Pages mini app URL)
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim()
const WEBAPP_URL =
  process.env.TELEGRAM_WEBAPP_URL?.trim() ??
  'https://longphu25.github.io/profile/telegram-btc-alert.html'

if (!BOT_TOKEN) {
  console.error('Set TELEGRAM_BOT_TOKEN before running the bot.')
  process.exit(1)
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`

async function tg(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(`${method}: ${JSON.stringify(json)}`)
  return json.result
}

async function ensureMenuButton() {
  await tg('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Chart Alert',
      web_app: { url: WEBAPP_URL },
    },
  })
}

function startKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: 'Mở Chart Alert',
          web_app: { url: WEBAPP_URL },
        },
      ],
    ],
  }
}

async function handleUpdate(update) {
  const msg = update.message
  if (!msg?.text) return

  const chatId = msg.chat.id
  const text = msg.text.trim()

  if (text === '/start' || text.startsWith('/start ')) {
    const param = text.split(/\s+/)[1]
    const url = param ? `${WEBAPP_URL}?tgWebAppStartParam=${encodeURIComponent(param)}` : WEBAPP_URL
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Chào bạn! Mở Mini App để xem ML bias và Trade Setup. Tài khoản Telegram sẽ tự động đăng nhập.',
      reply_markup: {
        inline_keyboard: [[{ text: 'Mở Chart Alert', web_app: { url } }]],
      },
    })
    return
  }

  if (text === '/chart') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Nhấn nút bên dưới để mở chart alert.',
      reply_markup: startKeyboard(),
    })
  }
}

async function poll(offset = 0) {
  const updates = await tg('getUpdates', { timeout: 50, offset })
  let next = offset
  for (const update of updates) {
    next = update.update_id + 1
    try {
      await handleUpdate(update)
    } catch (err) {
      console.error('handleUpdate failed', err)
    }
  }
  return poll(next)
}

console.log(`Bot polling. WebApp: ${WEBAPP_URL}`)
await ensureMenuButton()
await poll(0)