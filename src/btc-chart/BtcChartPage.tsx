// BTC Chart standalone page — hosts the BtcChart plugin in a Shadow DOM container.

import { useEffect, useRef, useState } from 'react'
import { hostAPI } from '../plugins/host'
import { loadPlugin } from '../plugins/loader'
import { ShadowContainer } from '../plugins/ShadowContainer'

const PLUGIN_SRC = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}plugins/btc-chart/plugin.tsx`
  : `${import.meta.env.BASE_URL}assets/plugins/btc-chart.js`

const STYLE_URL = '/plugins/btc-chart/style.css'

export function BtcChartPage() {
  const [Component, setComponent] = useState<React.ComponentType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    ;(async () => {
      try {
        const plugin = await loadPlugin(PLUGIN_SRC)
        plugin.mount?.()
        const C = hostAPI.getComponent(plugin.name) as React.ComponentType | undefined
        if (!C) throw new Error(`Component ${plugin.name} not registered`)
        setComponent(() => C)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [])

  if (error) {
    return (
      <div className="btc-page btc-page--error">
        <div>Failed to load BtcChart plugin</div>
        <div className="btc-page__err">{error}</div>
      </div>
    )
  }

  if (!Component) {
    return (
      <div className="btc-page btc-page--loading">
        <div className="btc-page__brand">
          <div className="btc-page__brand-mark" aria-hidden>
            M
          </div>
          <span className="btc-page__brand-name">Meridian</span>
          <span className="btc-page__brand-sub">Chart Terminal</span>
        </div>
        <div className="btc-page__spinner" />
        <span>Initializing chart engine…</span>
      </div>
    )
  }

  return (
    <div className="btc-page">
      <ShadowContainer styleUrls={[STYLE_URL]}>
        <Component />
      </ShadowContainer>
    </div>
  )
}
