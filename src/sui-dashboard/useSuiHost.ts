// React hook for plugins to consume shared Sui context
// Plugins import this hook to reactively access wallet/network state

import { useState, useEffect, useSyncExternalStore, useCallback } from 'react'
import type { SuiHostAPI, SuiContext } from './sui-types'

/** Use shared Sui context reactively inside a plugin component */
export function useSuiContext(host: SuiHostAPI): SuiContext {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return host.onSuiContextChange(onStoreChange)
    },
    [host],
  )

  const getSnapshot = useCallback(() => {
    return host.getSuiContext()
  }, [host])

  return useSyncExternalStore(subscribe, getSnapshot)
}

/** Use a shared data value reactively */
export function useSharedData<T = unknown>(host: SuiHostAPI, key: string): T | undefined {
  const [value, setValue] = useState<T | undefined>(() => host.getSharedData(key) as T | undefined)

  useEffect(() => {
    // Sync initial value
    setValue(host.getSharedData(key) as T | undefined)

    const unsub = host.onSharedDataChange(key, (newValue) => {
      setValue(newValue as T | undefined)
    })
    return unsub
  }, [host, key])

  return value
}
