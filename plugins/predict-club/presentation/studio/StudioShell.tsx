import { useEffect, useMemo, useState } from 'react'
import {
  getVolSurfaceSnapshot,
  startVolSurfaceService,
  stopVolSurfaceService,
  subscribeVolSurface,
  type VolSurfaceSnapshot,
} from '../../application/volSurfaceService'
import { fetchRealizedVol } from '../../application/realizedVol'
import { atmBandStrikes, getMispriceBand } from '../../application/mispricing'
import { checkArbFree } from '../../application/arbFreeCheck'
import { buildStudioRiskInput, submitStudioTrade } from '../../application/submitStudioTrade'
import { createSuiPredictGateway } from '../../infrastructure/suiPredictGateway'
import { quoteBinaryStrike } from '../../infrastructure/deepbookPredictPricingService'
import type { MispriceCell, RealizedVol, SurfaceCell, SurfaceColumn } from '../../domain/volSurface'
import { usePredictClub } from '../usePredictClub'
import { EdgePanel } from './EdgePanel'
import { SmileSlice } from './SmileSlice'
import { TimeTravel } from './TimeTravel'
import { TradeTicket, type TradeTicketResult } from './TradeTicket'
import { VolHeatmap } from './VolHeatmap'

// Contract param fallbacks when the oracle entry omits them (mirrors the cockpit's
// executeRound defaults so the Studio mint matches the cockpit's behavior).
const DEFAULT_TICK_SIZE = 1_000_000_000
const DEFAULT_MIN_STRIKE = 50_000_000_000_000

/**
 * Surface Studio layout primitive for the decision-support terminal.
 *
 * The Studio is a dedicated surface (its own Vite entry) that reuses the
 * predict-club data layer end to end. Story 22's chart-king cockpit stays
 * untouched; this surface owns the volatility surface view that the king chart
 * cannot host: a strike x expiry IV heatmap (S1), a per-expiry smile slice (S2),
 * and the trader edge panel (mispricing, IV vs realized vol, arb-free health).
 *
 * StudioShell owns the surface-service lifecycle, the selected-expiry column, the
 * realized-vol fetch, and the mispricing band, so the heatmap, smile, and edge
 * panels all read one consistent snapshot. The heatmap is presentational and
 * reports column clicks up. The mispricing band is the one network-costly piece:
 * it is fetched only for the ATM band of the selected column (decision 8).
 */

const REALIZED_REFRESH_MS = 60_000
const MISPRICE_REFRESH_MS = 20_000
// Strikes on each side of the forward to quote by default (band = 2*radius + 1).
const ATM_BAND_RADIUS = 3

export function StudioShell() {
  const { oracleSnapshot, context, host, predictManagerId, balances } = usePredictClub()
  const [surface, setSurface] = useState<VolSurfaceSnapshot>(getVolSurfaceSnapshot)
  const [selectedOracleId, setSelectedOracleId] = useState<string | null>(null)
  const [realized, setRealized] = useState<RealizedVol | null>(null)
  const [mispriceCells, setMispriceCells] = useState<MispriceCell[]>([])
  const [mispriceLoading, setMispriceLoading] = useState(false)
  // Time-travel index into surface.history; null = the live surface (S5).
  const [timeIndex, setTimeIndex] = useState<number | null>(null)
  // Trade ticket (S7): the clicked cell + its column + the anchor rect to position
  // the popover. Null when no ticket is open.
  const [ticket, setTicket] = useState<{
    cell: SurfaceCell
    column: SurfaceColumn
    anchorRect: DOMRect
  } | null>(null)

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

  const { loaded, history } = surface

  // Clamp the time-travel index if the buffer shrank, then pick the displayed
  // grid: a past snapshot when scrubbing, the live grid otherwise. The heatmap,
  // smile, and arb-free health all read this one grid so they stay consistent.
  const replaying = timeIndex != null && timeIndex < history.length
  const grid = replaying ? history[timeIndex].grid : surface.grid

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

  // Arb-free health is pure SVI math over the grid (no network), so recompute it
  // whenever the sampled surface changes.
  const arbReport = useMemo(() => checkArbFree(grid), [grid])

  // Mispricing for the selected column's ATM band: the one network-costly piece.
  // Refetched when the column changes (and on a slow timer for the same column),
  // bounded + cached inside getMispriceBand so testnet RPC survives.
  useEffect(() => {
    // Mispricing is a live-only signal: a contract quote for a past surface would
    // be misleading, so scrubbing into history clears the band rather than faking it.
    if (replaying || !selectedColumn || selectedColumn.degraded || grid.strikes.length === 0) {
      setMispriceCells([])
      return
    }
    let active = true
    const band = atmBandStrikes(grid.strikes, selectedColumn.forward, ATM_BAND_RADIUS)
    const load = () => {
      setMispriceLoading(true)
      getMispriceBand({
        oracleId: selectedColumn.oracleId,
        expiryMs: selectedColumn.expiryMs,
        strikes: band,
        forward: selectedColumn.forward,
        svi: selectedColumn.svi,
        walletAddress: context.address,
      })
        .then((cells) => {
          if (active) setMispriceCells(cells)
        })
        .finally(() => {
          if (active) setMispriceLoading(false)
        })
    }
    load()
    const timer = setInterval(load, MISPRICE_REFRESH_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [replaying, selectedColumn, grid.strikes, context.address])

  // Run the solo-trade pipeline for the open ticket. Looks up the oracle entry for
  // tick/min/expiry (cockpit fallbacks when omitted), resolves the manager id, builds
  // the risk input for one solo trade, then gate -> build -> sign via submitStudioTrade.
  const handleSubmit = async (
    direction: 'UP' | 'DOWN',
    amountDusdc: number,
  ): Promise<TradeTicketResult> => {
    if (!ticket) return { ok: false, error: 'No trade open' }
    const address = context.address
    if (!address || !host) return { ok: false, error: 'Wallet not connected' }
    const { cell, column } = ticket

    const gateway = createSuiPredictGateway()
    const managerId = predictManagerId ?? (await gateway.fetchManagerId(address))
    if (!managerId) return { ok: false, error: 'No PredictManager found - create one first' }

    const oracleEntry = oracleSnapshot.oracles.find((o) => o.oracle_id === column.oracleId)
    const tickSize = oracleEntry?.tick_size ?? DEFAULT_TICK_SIZE
    const minStrike = oracleEntry?.min_strike ?? DEFAULT_MIN_STRIKE
    const expiryMs = oracleEntry?.expiry ?? column.expiryMs

    const riskInput = buildStudioRiskInput({
      expiryMs,
      oracleStatus: oracleEntry?.status ?? null,
      oracleLastUpdateMs: oracleSnapshot.lastUpdateMs || null,
      hasSvi: !column.degraded && column.svi != null,
      hasForward: column.forward > 0,
      memberDusdc: balances.dusdc,
      amountDusdc,
      walletConnected: true,
      managerReady: true,
    })

    return submitStudioTrade(
      {
        direction,
        strike: cell.strike,
        amountDusdc,
        oracleId: column.oracleId,
        expiryMs,
        walletAddress: address,
        managerId,
        tickSize,
        minStrike,
      },
      {
        riskInput,
        gateway,
        preflightQuote: async () => {
          const quote = await quoteBinaryStrike({
            oracleId: column.oracleId,
            expiry: expiryMs,
            strikeUsd: cell.strike,
            isUp: direction === 'UP',
            tickSize,
            minStrike,
            walletAddress: address,
          })
          // A null implied probability means the contract refused to price this
          // strike (outside its bounds); quote.reason carries the friendly message.
          return quote.impliedProbability != null
            ? { ok: true }
            : { ok: false, reason: quote.reason }
        },
        signAndExecute: async (tx) => {
          const txResult = await host.signAndExecuteTransaction(tx)
          return { digest: (txResult as { digest?: string }).digest ?? '' }
        },
      },
    )
  }

  // The mispricing cell for the ticket's strike (when the clicked cell sits in the
  // quoted ATM band), so the ticket can show the contract probability + edge.
  const ticketMispriceCell = ticket
    ? mispriceCells.find((c) => c.strike === ticket.cell.strike)
    : undefined

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

      <TimeTravel
        history={history}
        selectedIndex={replaying ? timeIndex : null}
        onSelect={setTimeIndex}
      />

      {/* Main: heatmap is king (left, fills), smile + edge stack right. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-y-auto bg-outline-variant lg:grid-cols-[minmax(0,1fr)_24rem] lg:overflow-hidden [&>*]:min-h-[16rem] lg:[&>*]:min-h-0">
        <VolHeatmap
          grid={grid}
          loaded={loaded}
          selectedOracleId={effectiveOracleId}
          onSelect={setSelectedOracleId}
          onCellSelect={(column, cell, anchorRect) => setTicket({ cell, column, anchorRect })}
          mispriceCells={mispriceCells}
          arbReport={arbReport}
          className="min-h-0"
        />

        <div className="flex min-h-0 flex-col gap-px bg-outline-variant">
          <EdgePanel
            column={selectedColumn}
            realized={realized}
            mispriceCells={mispriceCells}
            mispriceLoading={mispriceLoading}
            arbReport={arbReport}
            className="shrink-0"
          />
          <SmileSlice column={selectedColumn} className="min-h-0 flex-1" />
        </div>
      </div>

      {ticket && (
        <TradeTicket
          cell={ticket.cell}
          column={ticket.column}
          mispriceCell={ticketMispriceCell}
          balances={balances}
          isConnected={context.isConnected}
          managerReady={predictManagerId != null}
          anchorRect={ticket.anchorRect}
          asset={asset}
          onConnect={() => host?.requestConnect()}
          onSubmit={handleSubmit}
          onClose={() => setTicket(null)}
        />
      )}
    </div>
  )
}
