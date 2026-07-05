import { useEffect, useState } from 'react'
import { authenticateTelegramInitData, buildLocalTelegramSession } from '../lib/telegram-auth'
import { getTelegramWebApp } from '../lib/telegram-webapp'
import type { TelegramAuthState } from '../lib/telegram-user'
import {
  loadStoredTelegramSession,
  saveTelegramSession,
  type TelegramUser,
} from '../lib/telegram-user'

const INITIAL: TelegramAuthState = {
  status: 'loading',
  user: null,
  verified: false,
  error: null,
}

function applySession(
  session: { user: TelegramUser; verified: boolean },
  setState: (s: TelegramAuthState) => void,
): void {
  setState({
    status: 'authenticated',
    user: session.user,
    verified: session.verified,
    error: null,
  })
}

/** Auto-login via Telegram WebApp initData when opened from the bot. */
export function useTelegramAuth(): TelegramAuthState {
  const [state, setState] = useState<TelegramAuthState>(INITIAL)

  useEffect(() => {
    let cancelled = false

    const finish = (next: TelegramAuthState) => {
      if (!cancelled) setState(next)
    }

    const run = async () => {
      const tg = getTelegramWebApp()
      const stored = loadStoredTelegramSession()

      if (stored && (!tg.user || stored.user.id === tg.user.id)) {
        finish({
          status: 'authenticated',
          user: stored.user,
          verified: stored.verified,
          error: null,
        })
        if (stored.verified || !tg.initData) return
      }

      if (!tg.isTelegram || !tg.user) {
        finish({
          status: 'guest',
          user: null,
          verified: false,
          error: null,
        })
        return
      }

      if (tg.initData) {
        try {
          const verified = await authenticateTelegramInitData(tg.initData)
          if (verified) {
            applySession(verified, finish)
            return
          }
        } catch {
          /* fall through to local session */
        }
      }

      const local = buildLocalTelegramSession(tg.user)
      saveTelegramSession(local)
      applySession(local, finish)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
