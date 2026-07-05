/** Minimal Telegram WebApp bridge (script tag from telegram.org). */

import { mapRawTelegramUser, type TelegramUser } from './telegram-user'

export interface TelegramTheme {
  readonly bg: string
  readonly text: string
  readonly hint: string
  readonly link: string
  readonly button: string
  readonly buttonText: string
  readonly secondaryBg: string
}

export interface TelegramWebAppBridge {
  readonly ready: () => void
  readonly expand: () => void
  readonly close: () => void
  readonly haptic: (kind: 'light' | 'medium' | 'heavy') => void
  readonly theme: TelegramTheme
  readonly startParam: string | null
  readonly initData: string | null
  readonly user: TelegramUser | null
  readonly userName: string | null
  readonly isTelegram: boolean
}

const FALLBACK_THEME: TelegramTheme = {
  bg: '#080a0d',
  text: '#e8eaed',
  hint: '#8a8f98',
  link: '#6fbcf0',
  button: '#e8b84a',
  buttonText: '#080a0d',
  secondaryBg: '#12151a',
}

function readTheme(): TelegramTheme {
  const twa = window.Telegram?.WebApp
  const p = twa?.themeParams
  if (!p) return FALLBACK_THEME
  return {
    bg: p.bg_color ?? FALLBACK_THEME.bg,
    text: p.text_color ?? FALLBACK_THEME.text,
    hint: p.hint_color ?? FALLBACK_THEME.hint,
    link: p.link_color ?? FALLBACK_THEME.link,
    button: p.button_color ?? FALLBACK_THEME.button,
    buttonText: p.button_text_color ?? FALLBACK_THEME.buttonText,
    secondaryBg: p.secondary_bg_color ?? FALLBACK_THEME.secondaryBg,
  }
}

function readUser(): TelegramUser | null {
  const raw = window.Telegram?.WebApp?.initDataUnsafe?.user
  if (!raw) return null
  return mapRawTelegramUser(raw as Record<string, unknown>)
}

/** Access Telegram WebApp APIs when running inside Telegram; safe no-ops in browser. */
export function getTelegramWebApp(): TelegramWebAppBridge {
  const twa = window.Telegram?.WebApp
  const initData = twa?.initData?.trim() ? twa.initData : null
  const user = readUser()
  const isTelegram = Boolean(initData && user)
  return {
    ready: () => twa?.ready(),
    expand: () => twa?.expand(),
    close: () => twa?.close(),
    haptic: (kind) => {
      try {
        twa?.HapticFeedback?.impactOccurred(kind)
      } catch {
        /* noop outside Telegram */
      }
    },
    theme: readTheme(),
    startParam: twa?.initDataUnsafe?.start_param ?? null,
    initData,
    user,
    userName: user?.firstName ?? null,
    isTelegram,
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void
        expand: () => void
        close: () => void
        initData?: string
        initDataUnsafe?: {
          start_param?: string
          user?: Record<string, unknown>
        }
        themeParams?: Record<string, string | undefined>
        HapticFeedback?: { impactOccurred: (style: string) => void }
      }
    }
  }
}
