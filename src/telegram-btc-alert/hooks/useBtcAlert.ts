import { useCallback, useEffect, useRef, useState } from 'react'
import type { Interval } from '@btc-chart/constants'
import {
  analyzeBtcAlert,
  parseAlertStartParam,
  symbolEntryFromId,
  type BtcAlertSnapshot,
} from '../lib/analyze-alert'
import { getTelegramWebApp } from '../lib/telegram-webapp'

const POLL_MS = 15_000

export interface UseBtcAlertOptions {
  readonly initialSymbol?: string
  readonly initialInterval?: Interval
}

export interface UseBtcAlertResult {
  readonly symbol: string
  readonly interval: Interval
  readonly snapshot: BtcAlertSnapshot | null
  readonly loading: boolean
  readonly error: string | null
  readonly setSymbol: (sym: string) => void
  readonly setInterval: (iv: Interval) => void
  readonly refresh: () => void
}

function biasKey(s: BtcAlertSnapshot | null): string {
  if (!s) return ''
  const b = s.setup.bias
  const p = s.setup.plan
  return `${b.dir ?? 'n'}:${b.bull}:${b.bear}:${p?.dir ?? 'n'}:${p?.candleTime ?? 0}`
}

/** Poll klines and run trade-setup analysis; haptic on bias/plan edge. */
export function useBtcAlert(options?: UseBtcAlertOptions): UseBtcAlertResult {
  const tg = getTelegramWebApp()
  const parsed = parseAlertStartParam(tg.startParam)
  const [symbol, setSymbolState] = useState(options?.initialSymbol ?? parsed.symbol ?? 'BTCUSDT')
  const [interval, setIntervalState] = useState<Interval>(
    options?.initialInterval ?? parsed.interval ?? '5m',
  )
  const [snapshot, setSnapshot] = useState<BtcAlertSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pollToken, setPollToken] = useState(0)
  const prevBiasKeyRef = useRef('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    const poll = async () => {
      try {
        const entry = symbolEntryFromId(symbol)
        const next = await analyzeBtcAlert(entry, interval)
        if (cancelled || !mountedRef.current) return
        const key = biasKey(next)
        if (prevBiasKeyRef.current && key !== prevBiasKeyRef.current) {
          tg.haptic('medium')
        }
        prevBiasKeyRef.current = key
        setSnapshot(next)
        setError(null)
      } catch (e) {
        if (cancelled || !mountedRef.current) return
        setError(e instanceof Error ? e.message : 'Analysis failed')
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false)
      }
    }

    void poll()
    const id = window.setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      mountedRef.current = false
      window.clearInterval(id)
    }
  }, [symbol, interval, pollToken, tg])

  const setSymbol = useCallback((sym: string) => {
    prevBiasKeyRef.current = ''
    setLoading(true)
    setSymbolState(sym.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  }, [])

  const setInterval = useCallback((iv: Interval) => {
    prevBiasKeyRef.current = ''
    setLoading(true)
    setIntervalState(iv)
  }, [])

  const refresh = useCallback(() => {
    setLoading(true)
    setPollToken((t) => t + 1)
  }, [])

  return { symbol, interval, snapshot, loading, error, setSymbol, setInterval, refresh }
}
