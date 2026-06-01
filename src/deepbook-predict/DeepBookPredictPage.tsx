import { useEffect, useRef, useState } from 'react'
import { hostAPI } from '../plugins/host'
import { loadPlugin } from '../plugins/loader'
import { ShadowContainer } from '../plugins/ShadowContainer'

const PLUGIN_SRC = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}plugins/sui-deepbook-predict/plugin.tsx`
  : `${import.meta.env.BASE_URL}assets/plugins/sui-deepbook-predict.js`

const STYLE_URL = '/plugins/sui-deepbook-predict/style.css'

export function DeepBookPredictPage() {
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

  if (error)
    return (
      <div className="dp-page dp-page--error">
        <div>Failed to load DeepBook Predict</div>
        <div className="dp-page__err">{error}</div>
      </div>
    )

  if (!Component)
    return (
      <div className="dp-page dp-page--loading">
        <div className="dp-page__spinner" />
        <span>Loading DeepBook Predict…</span>
      </div>
    )

  return (
    <div className="dp-page">
      <ShadowContainer styleUrls={[STYLE_URL]}>
        <Component />
      </ShadowContainer>
    </div>
  )
}
