import { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
  fetchManagerBinaryPositions,
  type ManagerPosition,
  sanitizeClaimError,
} from '../../infrastructure/deepbookPredictPricingService'
import {
  classifyPosition,
  positionSideLabel,
  positionStrikeUsd,
} from '../../domain/studioPositions'
import type { MispriceCell, RealizedVol, SurfaceCell, SurfaceColumn } from '../../domain/volSurface'
import { usePredictClub } from '../usePredictClub'
import { EdgePanel } from './EdgePanel'
import { PositionsDrawer, type ClaimActionResult } from './PositionsDrawer'
import { SmileSlice } from './SmileSlice'
import { TimeTravel } from './TimeTravel'
import { TradeTicket, type TradeTicketResult } from './TradeTicket'
import { VolHeatmap } from './VolHeatmap'

// Contract param fallbacks when the oracle entry omits them (mirrors the cockpit's
// executeRound defaults so the Studio mint matches the cockpit's behavior).
const DEFAULT_TICK_SIZE = 1_000_000_000
const DEFAULT_MIN_STRIKE = 50_000_000_000_000

// Minted-position markers persist in localStorage keyed by wallet address, so a
// trader still sees where they hold after a refresh. Scoped per address so switching
// accounts never shows another wallet's positions. The chain stays the source of
// truth; this is a fast local hint, so any storage error degrades to an empty set.
const MINTED_STORE_PREFIX = 'predict-club:studio:minted:'
// On a refresh the dapp-kit wallet reconnects asynchronously, so context.address is
// null for the first frames. Without a fallback the marker load would key on null and
// show nothing until the wallet rehydrates (and if it never auto-reconnects, never).
// We remember the last address that minted so the marker paints immediately on load
// and is replaced the moment the live address resolves (same address - no change;
// different address - that wallet's own set).
const MINTED_LAST_ADDRESS_KEY = `${MINTED_STORE_PREFIX}lastAddress`

function mintedStorageKey(address: string | null): string | null {
  return address ? `${MINTED_STORE_PREFIX}${address.toLowerCase()}` : null
}

function readLastMintedAddress(): string | null {
  try {
    return localStorage.getItem(MINTED_LAST_ADDRESS_KEY)
  } catch {
    return null
  }
}

// Load the marker set for an address, falling back to the last minting address when
// the live address is null (wallet not yet reconnected after a refresh).
function loadMintedKeys(address: string | null): Set<string> {
  const effective = address ?? readLastMintedAddress()
  const storageKey = mintedStorageKey(effective)
  if (!storageKey) return new Set()
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? new Set(parsed.filter((x): x is string => typeof x === 'string'))
      : new Set()
  } catch {
    return new Set()
  }
}

function persistMintedKeys(address: string | null, keys: Set<string>): void {
  const storageKey = mintedStorageKey(address)
  if (!storageKey) return
  try {
    localStorage.setItem(storageKey, JSON.stringify([...keys]))
    if (address) localStorage.setItem(MINTED_LAST_ADDRESS_KEY, address.toLowerCase())
  } catch {
    // Storage unavailable or over quota: the in-memory set still drives the UI.
  }
}

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
// Positions read from chain are slow-moving (a trader mints/claims rarely), so
// refetch on a slow cadence plus the event-driven refreshes (wallet change, after
// a confirmed mint/claim) rather than per oracle tick.
const POSITIONS_REFRESH_MS = 30_000
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
  // Cells the trader has minted a position on, keyed `oracleId|strike` (same key
  // shape as the arb-violation set). The heatmap tints these so a trader can see at a
  // glance where they already hold a position. Persisted in localStorage per wallet
  // address so the marker survives a refresh; the chain stays the source of truth, so
  // this is only a fast local hint.
  const [mintedKeys, setMintedKeys] = useState<Set<string>>(() => loadMintedKeys(context.address))
  // Trade ticket (S7): the clicked cell + its column + the anchor rect to position
  // the popover. Null when no ticket is open.
  const [ticket, setTicket] = useState<{
    cell: SurfaceCell
    column: SurfaceColumn
    anchorRect: DOMRect
  } | null>(null)
  // Positions/history drawer (S9): the trader's real binary positions read from
  // their PredictManager (the chain is the source of truth, not the localStorage
  // mint hint). Open state drives the slide-in sheet; the list refetches on wallet
  // change, after a confirmed mint/claim, and on a slow timer while connected.
  const [positions, setPositions] = useState<ManagerPosition[]>([])
  const [positionsOpen, setPositionsOpen] = useState(false)

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

  // Reload the minted markers when the wallet address changes (connect or account
  // switch after mount). The initial state already seeds from storage, so this only
  // re-syncs on a later address change, keeping each wallet's markers separate.
  useEffect(() => {
    setMintedKeys(loadMintedKeys(context.address))
  }, [context.address])

  // Read the trader's real binary positions from their PredictManager. The chain is
  // the source of truth for the drawer (the mint hint in localStorage only tints the
  // heatmap). Refetched on wallet/manager change, after a confirmed mint or claim,
  // and on a slow timer while connected; cleared when disconnected.
  const refreshPositions = useCallback(() => {
    const address = context.address
    if (!address) {
      setPositions([])
      return
    }
    fetchManagerBinaryPositions(address, predictManagerId).then((next) => {
      setPositions(next)
    })
  }, [context.address, predictManagerId])

  useEffect(() => {
    refreshPositions()
    if (!context.address) return
    const timer = setInterval(refreshPositions, POSITIONS_REFRESH_MS)
    return () => clearInterval(timer)
  }, [refreshPositions, context.address])

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

  // Rebind stored minted strikes to the current grid rows. The strike axis is
  // re-derived from the live (drifting) forward on every sample, so a strike stored
  // at mint time rarely equals a current row integer after a refresh - an exact key
  // match would then find no cell and the marker would vanish. Snap each stored
  // strike to the nearest row within ~one step so the marker survives the drift; rows
  // for an expired oracle (no longer in the grid) are dropped.
  const resolvedMintedKeys = useMemo(() => {
    const strikes = grid.strikes
    if (mintedKeys.size === 0 || strikes.length === 0) return mintedKeys
    let spacing = Number.POSITIVE_INFINITY
    for (let i = 0; i < strikes.length - 1; i += 1) {
      const d = Math.abs(strikes[i] - strikes[i + 1])
      if (d > 0 && d < spacing) spacing = d
    }
    const tol = Number.isFinite(spacing) ? spacing : Number.POSITIVE_INFINITY
    const oracleIds = new Set(grid.columns.map((c) => c.oracleId))
    const resolved = new Set<string>()
    for (const key of mintedKeys) {
      const sep = key.lastIndexOf('|')
      if (sep < 0) continue
      const oracleId = key.slice(0, sep)
      const strike = Number(key.slice(sep + 1))
      if (!oracleIds.has(oracleId) || !Number.isFinite(strike)) continue
      let nearest = strikes[0]
      let best = Math.abs(strikes[0] - strike)
      for (const s of strikes) {
        const d = Math.abs(s - strike)
        if (d < best) {
          best = d
          nearest = s
        }
      }
      if (best <= tol) resolved.add(`${oracleId}|${nearest}`)
    }
    return resolved
  }, [mintedKeys, grid.strikes, grid.columns])

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

    const result = await submitStudioTrade(
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
          // Simulate the REAL mint PTB read-only (devInspect): it runs predict::mint
          // and trips every mint-time guard a live sign would, including
          // assert_mintable_ask (abort 7) for a strike too deep in/out of the money.
          // The old pricing read (get_trade_amounts) skipped that guard, so a doomed
          // strike could pass pre-flight and still abort after the user signed.
          return gateway.simulateMintBinary({
            walletAddress: address,
            managerId,
            direction,
            strike: cell.strike,
            amountDusdc,
            oracleId: column.oracleId,
            expiry: expiryMs,
            tickSize,
            minStrike,
          })
        },
        signAndExecute: async (tx) => {
          const txResult = await host.signAndExecuteTransaction(tx)
          return { digest: (txResult as { digest?: string }).digest ?? '' }
        },
      },
    )

    // On a confirmed mint, mark this cell so the heatmap tints it, and persist the
    // marker per wallet so it survives a refresh. The chain stays the source of truth;
    // this is a fast local hint of where the trader already holds.
    if (result.ok) {
      setMintedKeys((prev) => {
        const next = new Set(prev)
        next.add(`${column.oracleId}|${cell.strike}`)
        persistMintedKeys(address, next)
        return next
      })
      // The new position now lives on chain, so refresh the drawer's source of truth.
      refreshPositions()
    }
    return result
  }

  // Read-only claim pre-flight for one position: build the real claim PTB and
  // devInspect it so the contract decides claimability (settled + won + unclaimed),
  // with zero gas and no wallet prompt. Looks up tick/min from the oracle entry (same
  // cockpit fallbacks as the mint path) so the simulated key matches the minted one.
  const simulateClaim = async (position: ManagerPosition) => {
    const address = context.address
    if (!address) return { ok: false, reason: 'Wallet not connected' }
    const gateway = createSuiPredictGateway()
    const managerId = predictManagerId ?? (await gateway.fetchManagerId(address))
    if (!managerId) return { ok: false, reason: 'No PredictManager found' }
    const side = positionSideLabel(position)
    const strike = positionStrikeUsd(position)
    if (side == null || strike == null) return { ok: false, reason: 'Position not claimable' }
    const oracleEntry = oracleSnapshot.oracles.find((o) => o.oracle_id === position.oracleId)
    return gateway.simulateClaim({
      walletAddress: address,
      managerId,
      oracleId: position.oracleId,
      expiry: position.expiry,
      strike,
      isUp: side === 'UP',
      tickSize: oracleEntry?.tick_size ?? DEFAULT_TICK_SIZE,
      minStrike: oracleEntry?.min_strike ?? DEFAULT_MIN_STRIKE,
    })
  }

  // Claim a settled, winning position: build the claim PTB and sign it (a real
  // on-chain transaction, the one place the drawer leaves read-only). The contract
  // re-checks claimability, so a doomed claim is already filtered by the pre-flight.
  // Refreshes the drawer after so the claimed position reflects its new state.
  const handleClaim = async (position: ManagerPosition): Promise<ClaimActionResult> => {
    const address = context.address
    if (!address || !host) return { ok: false, error: 'Wallet not connected' }
    const gateway = createSuiPredictGateway()
    const managerId = predictManagerId ?? (await gateway.fetchManagerId(address))
    if (!managerId) return { ok: false, error: 'No PredictManager found' }
    const side = positionSideLabel(position)
    const strike = positionStrikeUsd(position)
    if (side == null || strike == null) return { ok: false, error: 'Position not claimable' }
    const oracleEntry = oracleSnapshot.oracles.find((o) => o.oracle_id === position.oracleId)
    try {
      const tx = await gateway.buildClaimTx({
        walletAddress: address,
        managerId,
        oracleId: position.oracleId,
        expiry: position.expiry,
        strike,
        isUp: side === 'UP',
        tickSize: oracleEntry?.tick_size ?? DEFAULT_TICK_SIZE,
        minStrike: oracleEntry?.min_strike ?? DEFAULT_MIN_STRIKE,
      })
      const txResult = await host.signAndExecuteTransaction(tx)
      refreshPositions()
      return { ok: true, digest: (txResult as { digest?: string }).digest ?? '' }
    } catch (error) {
      return { ok: false, error: sanitizeClaimError(error) }
    }
  }

  // The mispricing cell for the ticket's strike (when the clicked cell sits in the
  // quoted ATM band), so the ticket can show the contract probability + edge.
  const ticketMispriceCell = ticket
    ? mispriceCells.find((c) => c.strike === ticket.cell.strike)
    : undefined

  const liveExpiries = grid.columns.length
  const asset = oracleSnapshot.oracleState?.underlying_asset ?? 'BTC'

  // Count of still-running positions, for the status-band badge. The drawer does the
  // full live/expired split itself; this is just the at-a-glance number.
  const livePositions = useMemo(
    () => positions.filter((p) => classifyPosition(p, Date.now()) === 'live').length,
    [positions],
  )

  // Forward price per oracle, so the drawer can show each position's moneyness
  // against the current price. Derived from the live grid columns.
  const forwardByOracle = useMemo(() => {
    const map = new Map<string, number>()
    for (const column of grid.columns) {
      if (column.forward > 0) map.set(column.oracleId, column.forward)
    }
    return map
  }, [grid.columns])

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
        <span className="ml-auto h-3 w-px bg-outline-variant" />
        <button
          type="button"
          data-pc-studio-positions-open
          onClick={() => setPositionsOpen(true)}
          className="flex items-center gap-1 rounded-sm px-sm py-1 font-label text-label-caps uppercase tracking-wide text-on-surface outline-none transition-colors hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            receipt_long
          </span>
          Positions
          {livePositions > 0 && (
            <span className="rounded-full bg-primary-fixed-dim px-1.5 font-data text-[10px] tabular-nums text-on-primary-fixed">
              {livePositions}
            </span>
          )}
        </button>
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
          mintedKeys={resolvedMintedKeys}
          realized={realized}
          className="min-h-0"
        />

        <div className="flex min-h-0 flex-col gap-px overflow-y-auto bg-outline-variant">
          <SmileSlice
            column={selectedColumn}
            mispriceCells={mispriceCells}
            className="min-h-[20rem] flex-1"
          />
          <EdgePanel
            column={selectedColumn}
            realized={realized}
            mispriceCells={mispriceCells}
            mispriceLoading={mispriceLoading}
            arbReport={arbReport}
            className="shrink-0"
          />
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

      {positionsOpen && (
        <PositionsDrawer
          positions={positions}
          isConnected={context.isConnected}
          forwardByOracle={forwardByOracle}
          asset={asset}
          simulateClaim={simulateClaim}
          onClaim={handleClaim}
          onConnect={() => host?.requestConnect()}
          onClose={() => setPositionsOpen(false)}
        />
      )}
    </div>
  )
}
