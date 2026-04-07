// PluginRenderer - Renders a registered plugin component inside Shadow DOM
// Each plugin's CSS is scoped to its own shadow root

import { useState, useEffect, type ReactNode } from 'react'
import { hostAPI } from './host'
import { loadPlugin } from './loader'
import { ShadowContainer } from './ShadowContainer'
import type { Plugin } from './types'

interface PluginRendererProps {
  /** URL or path to the plugin bundle */
  src: string
  /** Name of the registered component to render */
  componentName: string
  /** Shown while the plugin is loading */
  fallback?: ReactNode
}

export function PluginRenderer({ src, componentName, fallback }: PluginRendererProps) {
  const [plugin, setPlugin] = useState<Plugin | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadPlugin(src)
      .then((p) => {
        if (!cancelled) {
          p.mount?.()
          setPlugin(p)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err))
      })

    return () => {
      cancelled = true
      plugin?.unmount?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  if (error) {
    return (
      <div role="alert" style={{ color: 'red' }}>
        Plugin error: {error}
      </div>
    )
  }

  const Component = hostAPI.getComponent(componentName)

  if (!Component) {
    return <>{fallback ?? <span>Loading plugin...</span>}</>
  }

  return (
    <ShadowContainer styleUrls={plugin?.styleUrls}>
      <Component />
    </ShadowContainer>
  )
}
