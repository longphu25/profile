// usePlugin - Hook for loading a plugin in a React component

import { useState, useEffect } from 'react'
import type { Plugin } from './types'
import { loadPlugin } from './loader'

interface UsePluginResult {
  plugin: Plugin | null
  loading: boolean
  error: string | null
}

export function usePlugin(src: string): UsePluginResult {
  const [plugin, setPlugin] = useState<Plugin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)

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
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      plugin?.unmount?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  return { plugin, loading, error }
}
