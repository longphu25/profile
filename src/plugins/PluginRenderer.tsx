// PluginRenderer - Renders a registered plugin component inside Shadow DOM
// Each plugin's CSS is scoped to its own shadow root

import { useState, useEffect, type ComponentType, type ReactNode } from 'react'
import { hostAPI } from './host'
import { loadPlugin } from './loader'
import { ShadowContainer } from './ShadowContainer'
import type { Plugin } from './types'

function RenderPluginComponent({ component: Component }: { component: ComponentType }) {
  return <Component />
}

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
  const [Component, setComponent] = useState<ComponentType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeSrc, setActiveSrc] = useState(src)
  const [activeComponentName, setActiveComponentName] = useState(componentName)

  if (activeSrc !== src || activeComponentName !== componentName) {
    setActiveSrc(src)
    setActiveComponentName(componentName)
    setPlugin(null)
    setComponent(null)
    setError(null)
  }

  useEffect(() => {
    let cancelled = false

    loadPlugin(src)
      .then((p) => {
        if (!cancelled) {
          p.mount?.()
          setPlugin(p)
          setComponent(() => hostAPI.getComponent(componentName) ?? null)
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

  if (!Component) {
    return <>{fallback ?? <span>Loading plugin...</span>}</>
  }

  return (
    <ShadowContainer styleUrls={plugin?.styleUrls}>
      <RenderPluginComponent component={Component} />
    </ShadowContainer>
  )
}
