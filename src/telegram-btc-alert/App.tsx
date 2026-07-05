import { useEffect, useMemo } from 'react'
import { AlertScreen } from './components/AlertScreen'
import { useBtcAlert } from './hooks/useBtcAlert'
import { getTelegramWebApp } from './lib/telegram-webapp'

export function App() {
  const tg = useMemo(() => getTelegramWebApp(), [])
  const alert = useBtcAlert()

  useEffect(() => {
    tg.ready()
    tg.expand()
    document.documentElement.style.setProperty('--tga-bg', tg.theme.bg)
    document.documentElement.style.setProperty('--tga-text', tg.theme.text)
    document.documentElement.style.setProperty('--tga-hint', tg.theme.hint)
    document.documentElement.style.setProperty('--tga-link', tg.theme.link)
    document.documentElement.style.setProperty('--tga-btn', tg.theme.button)
    document.documentElement.style.setProperty('--tga-btn-text', tg.theme.buttonText)
    document.documentElement.style.setProperty('--tga-surface', tg.theme.secondaryBg)
  }, [tg])

  const chartUrl = useMemo(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}${base}/btc-chart.html`
  }, [])

  return (
    <AlertScreen
      symbol={alert.symbol}
      interval={alert.interval}
      snapshot={alert.snapshot}
      loading={alert.loading}
      error={alert.error}
      chartUrl={chartUrl}
      onSymbolChange={alert.setSymbol}
      onIntervalChange={alert.setInterval}
      onRefresh={alert.refresh}
    />
  )
}
