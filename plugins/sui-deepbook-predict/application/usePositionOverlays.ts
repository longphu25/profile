import { useCallback, useEffect, useState } from 'react'
import { getPortfolioSnapshot } from '../data/managerRepository'
import { toBinaryOverlays, toRangeOverlays } from '../domain/positions'
import type { PositionOverlay } from '../domain/types'

interface UsePositionOverlaysResult {
  overlays: PositionOverlay[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function usePositionOverlays(
  managerIds: string[],
  oracleId: string | null,
  refreshKey: number,
): UsePositionOverlaysResult {
  const [overlays, setOverlays] = useState<PositionOverlay[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (managerIds.length === 0 || !oracleId) {
      setOverlays([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const snapshot = await getPortfolioSnapshot(managerIds)
      const next = [
        ...toBinaryOverlays(snapshot.positions),
        ...toRangeOverlays(snapshot.ranges),
      ].filter((overlay) => overlay.oracleId === oracleId && overlay.quantity > 0)
      setOverlays(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load position overlays')
    } finally {
      setLoading(false)
    }
  }, [managerIds, oracleId])

  useEffect(() => {
    refresh()
  }, [refresh, refreshKey])

  return { overlays, loading, error, refresh }
}
