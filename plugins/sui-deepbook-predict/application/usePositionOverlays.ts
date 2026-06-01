import { useCallback, useEffect, useRef, useState } from 'react'
import { getPortfolioSnapshot } from '../data/managerRepository'
import { mergeOverlays } from '../domain/positions'
import type { PositionOverlay } from '../domain/types'

interface UsePositionOverlaysResult {
  overlays: PositionOverlay[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// Cache merged overlays by managerIds + oracleId + refreshKey so repeated
// renders (new managerIds array references) don't refetch the same snapshot.
const overlayCache = new Map<string, PositionOverlay[]>()

function cacheKey(managerIds: string[], oracleId: string | null, refreshKey: number): string {
  return `${[...managerIds].sort().join(',')}|${oracleId ?? ''}|${refreshKey}`
}

export function usePositionOverlays(
  managerIds: string[],
  oracleId: string | null,
  refreshKey: number,
): UsePositionOverlaysResult {
  const key = cacheKey(managerIds, oracleId, refreshKey)
  const idsRef = useRef(managerIds)
  idsRef.current = managerIds

  const [overlays, setOverlays] = useState<PositionOverlay[]>(() => overlayCache.get(key) ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const ids = idsRef.current
    if (ids.length === 0 || !oracleId) {
      setOverlays([])
      return
    }
    const cached = overlayCache.get(key)
    if (cached) {
      setOverlays(cached)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const snapshot = await getPortfolioSnapshot(ids)
      const next = mergeOverlays(snapshot, oracleId)
      overlayCache.set(key, next)
      setOverlays(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load position overlays')
    } finally {
      setLoading(false)
    }
  }, [key, oracleId])

  const refresh = useCallback(async () => {
    overlayCache.delete(key)
    await load()
  }, [key, load])

  useEffect(() => {
    load()
  }, [load])

  return { overlays, loading, error, refresh }
}
