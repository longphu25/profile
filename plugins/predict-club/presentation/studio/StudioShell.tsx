import { useEffect, useMemo, useState } from 'react'
import {
  getVolSurfaceSnapshot,
  startVolSurfaceService,
  stopVolSurfaceService,
  subscribeVolSurface,
  type VolSurfaceSnapshot,
} from '../../application/volSurfaceService'
import { fetchRealizedVol } from '../../application/realizedVol'
import type { RealizedVol } from '../../domain/volSurface'
import { usePredictClub } from '../usePredictClub'
import { EdgePanel } from './EdgePanel'
import { SmileSlice } from './SmileSlice'
import { VolHeatmap } from './VolHeatmap'

/**
 * Surface Studio layout primitive for the decision-support terminal.
 *
 * The Studio is a dedicated surface (its own Vite entry) that reuses the
 * predict-club data layer end to end. Story 22's chart-king cockpit stays
 * untouched; this surface owns the volatility surface view that the king chart
 * cannot host: a strike x expiry IV heatmap (S1), a per-expiry smile slice (S2),
 * and the trader edge panel (mispricing, IV vs realized vol, arb-free health).
 *
 * StudioShell owns the surface-service lifecycle, the selected-expiry column, and
 * the realized-vol fetch, so the heatmap, smile, and edge panels all read one
 * consistent snapshot. The heatmap is presentational and reports column clicks up.
 */

const REALIZED_REFRESH_MS = 60_000

export function StudioShell() {
  const { oracleSnapshot } = usePredictClub()
  const [surface, setSurface] = useState<VolSurfaceSnapshot>(getVolSurfaceSnapshot)
  const [selectedOracleId, setSelectedOracleId] = useState<string | null>(null)
  const [realized, setRealized] = useState<RealizedVol | null>(null)

  // Own the surface service lifecycle: start the SVI fan-out on mount, stop on
  // unmount, so cockpit-only users never pay for it.
  useEffect(() => {
    const unsub = subscribeVolSurface(setSurface)
    startVolSurfaceService()
    return () => {
      unsub()
      stopVolSurfaceService()
    }
  }, [])

  // Realized vol from the shared Binance reference history; refreshed on a slow
  // cadence (it is a slow-moving 1-minute-bar estimate, not a per-tick figure).
  useEffect(() => {
    let active = true
    const load = () => {
      fetchRealizedVol().then((rv) => {
        if (active) setRealized(rv)
      })
    }
    load()
    const timer = setInterval(load, REALIZED_REFRESH_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  const { grid, loaded } = surface

  // Default the selection to the nearest expiry once the grid arrives; keep the
  // user's choice if it is still a live column, else fall back to the first.
  const effectiveOracleId = useMemo(() => {
    if (grid.columns.length === 0) return null
    if (selectedOracleId && grid.columns.some((c) => c.oracleId === selectedOracleId)) {
      return selectedOracleId
    }
    return grid.columns[0].oracleId
  }, [grid.columns, selectedOracleId])

  const selectedColumn = useMemo(
    () => grid.columns.find((c) => c.oracleId === effectiveOracleId) ?? null,
    [grid.columns, effectiveOracleId],
  )

  const liveExpiries = grid.columns.length
  const asset = oracleSnapshot.oracleState?.underlying_asset ?? 'BTC'

  return (
    <div
      data-pc-studio
      className="flex h-full min-h-0 flex-col gap-px overflow-x-hidden bg-outline-variant"
    >
      {/* Thin status band: what surface, how many live expiries, feed health. */}
      <div
        data-pc-studio-status
        className="flex shrink-0 flex-wrap items-center gap-md bg-surface-container-lowest px-md py-sm font-data text-data-sm text-on-surface-variant"
      >
        <span className="flex items-center gap-1">
          <span className="text-primary-fixed-dim">Asset</span>
          <span className="tabular-nums text-on-surface">{asset}</span>
        </span>
        <span className="h-3 w-px bg-outline-variant" />
        <span className="flex items-center gap-1">
          <span className="text-primary-fixed-dim">Live expiries</span>
          <span className="tabular-nums text-on-surface">{liveExpiries}</span>
        </span>
        <span className="h-3 w-px bg-outline-variant" />
        <span className="flex items-center gap-1">
          <span className="text-primary-fixed-dim">Feed</span>
          <span className={oracleSnapshot.isHealthy ? 'text-primary-fixed-dim' : 'text-error'}>
            {oracleSnapshot.isHealthy ? 'live' : 'stale'}
          </span>
        </span>
      </div>

      {/* Main: heatmap is king (left, fills), smile + edge stack right. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-y-auto bg-outline-variant lg:grid-cols-[minmax(0,1fr)_24rem] lg:overflow-hidden [&>*]:min-h-[16rem] lg:[&>*]:min-h-0">
        <VolHeatmap
          grid={grid}
          loaded={loaded}
          selectedOracleId={effectiveOracleId}
          onSelect={setSelectedOracleId}
          className="min-h-0"
        />

        <div className="flex min-h-0 flex-col gap-px bg-outline-variant">
          <SmileSlice column={selectedColumn} className="min-h-0 flex-1" />
          <EdgePanel column={selectedColumn} realized={realized} className="shrink-0" />
        </div>
      </div>
    </div>
  )
}
