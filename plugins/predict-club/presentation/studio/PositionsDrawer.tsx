import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ManagerGroup,
  ManagerPosition,
} from '../../infrastructure/deepbookPredictPricingService'
import {
  classifyPosition,
  positionKey,
  positionLean,
  positionMoneyness,
  positionOutcomeRule,
  positionSideLabel,
  positionStrikeUsd,
} from '../../domain/studioPositions'

/**
 * Positions / history drawer (plan 23, S9): a sheet that slides in from the right
 * and lists the trader's real binary positions in their PredictManager, grouped
 * into Live (still running, with a countdown) and Settled (expired).
 *
 * The chain is the source of truth here, not the localStorage minted hint that
 * tints the heatmap: positions come from `fetchManagerBinaryPositions`. Whether a
 * settled position can be claimed is decided by the contract via a read-only
 * devInspect pre-flight (`simulateClaim`), never guessed from a settlement price
 * the UI does not authoritatively hold - so a Claim button appears only when the
 * chain agrees, and a losing / unsettled / already-claimed position shows a reason.
 *
 * Presentational and unit-friendly: it owns the per-position pre-flight + claim
 * lifecycle state, but the chain reads and the gate -> build -> sign pipeline are
 * injected (`simulateClaim`, `onClaim`) so it never touches the wallet host or RPC
 * directly. It is an ARIA dialog: it traps Tab, a document-level Escape closes it,
 * and a transparent backdrop closes on click-outside - the same pattern as the
 * trade ticket.
 */

const EXPLORER_TX = 'https://suiscan.xyz/testnet/tx'

export interface ClaimActionResult {
  ok: boolean
  digest?: string
  error?: string
}

interface PreflightState {
  loading: boolean
  ok: boolean
  reason?: string
}

function formatUsd(value: number): string {
  return value >= 1000 ? `$${Math.round(value).toLocaleString('en-US')}` : `$${value}`
}

// A coarse countdown to expiry for a live position. Positions carry expiry in ms,
// so this compares against Date.now() in the same unit. Collapses to "<1m" near the
// boundary rather than showing a misleading 0.
function formatCountdown(expiryMs: number, nowMs: number): string {
  const s = Math.max(0, Math.floor((expiryMs - nowMs) / 1000))
  if (s < 60) return '<1m'
  if (s < 3600) return `${Math.round(s / 60)}m`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

export function PositionsDrawer({
  groups,
  isConnected,
  forwardByOracle,
  asset = 'BTC',
  simulateClaim,
  onClaim,
  simulateRedeem,
  onRedeem,
  onConnect,
  onClose,
}: {
  groups: ManagerGroup[]
  isConnected: boolean
  forwardByOracle: Map<string, number>
  asset?: string
  simulateClaim: (position: ManagerPosition) => Promise<{ ok: boolean; reason?: string }>
  onClaim: (position: ManagerPosition) => Promise<ClaimActionResult>
  simulateRedeem: (position: ManagerPosition) => Promise<{ ok: boolean; reason?: string }>
  onRedeem: (position: ManagerPosition) => Promise<ClaimActionResult>
  onConnect: () => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  // Per-position claim pre-flight verdict (settled group only), keyed by the stable
  // position key so a refetch keeps each row's resolved status.
  const [preflight, setPreflight] = useState<Record<string, PreflightState>>({})
  // The position key currently being claimed (one at a time), and the claim result
  // per position so a confirmed claim shows its digest in place.
  const [claiming, setClaiming] = useState<string | null>(null)
  const [claimResults, setClaimResults] = useState<Record<string, ClaimActionResult>>({})
  // Live positions get their own unwind pre-flight + result, keyed the same way. A
  // position can only ever be in one group (live or settled), so the two pre-flight
  // maps never collide on a key.
  const [unwindPreflight, setUnwindPreflight] = useState<Record<string, PreflightState>>({})
  const [unwinding, setUnwinding] = useState<string | null>(null)
  const [unwindResults, setUnwindResults] = useState<Record<string, ClaimActionResult>>({})
  // A 1s tick so live countdowns advance while the drawer is open. Only armed when
  // there is at least one live position, so a settled-only list stays idle.
  const [nowMs, setNowMs] = useState(() => Date.now())
  // A wallet can hold several PredictManagers, each with its own positions. By
  // default the drawer lists them separately (one labelled group per manager) so the
  // trader sees which manager holds what; the toggle folds them into a single
  // Live/Settled view. Off by default - listing keeps managers distinct, the user
  // opts into combining rather than the drawer silently merging them.
  const [combineManagers, setCombineManagers] = useState(false)

  // Flat list across every manager, for the combined view and the summary roll-up.
  const positions = useMemo(() => groups.flatMap((group) => group.positions), [groups])

  const live = positions.filter((p) => classifyPosition(p, nowMs) === 'live')
  const settled = positions.filter((p) => classifyPosition(p, nowMs) === 'expired')

  // The wallet's managers come straight from the grouped read (newest first), so an
  // empty manager still appears - the trader sees every manager exists, not only the
  // ones holding positions. (Re-deriving from positions would silently hide an empty
  // manager, which is exactly what we want to avoid.)
  const multiManager = groups.length > 1
  // Show one merged view when the trader asked to combine, or when there is at most one
  // manager (nothing to separate).
  const showCombined = combineManagers || !multiManager

  // Settled breakdown straight from the contract's verdicts (pre-flight + claim
  // results), never guessed from a settlement price. A claim confirmed this session
  // counts as Claimed; an ok pre-flight is a winnable (claimable) position; an
  // aborted pre-flight is no payout. The contract aborts the same way whether a
  // position lost or was already claimed in a prior session, so that group is
  // labelled "No payout" rather than a fabricated pure-loss count.
  const summary = settled.reduce(
    (acc, position) => {
      const key = positionKey(position)
      if (claimResults[key]?.ok) acc.claimed += 1
      else {
        const verdict = preflight[key]
        if (!verdict || verdict.loading) acc.checking += 1
        else if (verdict.ok) acc.claimable += 1
        else acc.noPayout += 1
      }
      return acc
    },
    { claimable: 0, claimed: 0, noPayout: 0, checking: 0 },
  )

  // Focus the dialog on mount so Tab is trapped from the start.
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  // Escape closes from anywhere - a mouse user who opened the drawer from the status
  // band has no focus inside it, so a dialog-scoped handler would miss it. keydown is
  // a composed event, so this fires even though the studio lives in a shadow root.
  useEffect(() => {
    const onDocKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onDocKeyDown)
    return () => document.removeEventListener('keydown', onDocKeyDown)
  }, [onClose])

  // Tick the clock once a second only while a live position needs a countdown.
  useEffect(() => {
    if (live.length === 0) return
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [live.length])

  // Run the claim pre-flight for each settled position so the drawer can offer a
  // Claim button only where the contract agrees. Re-runs when the settled set
  // changes; a position already claimed in this session is skipped (its result row
  // stands). The contract is the source of truth - this never guesses from price.
  useEffect(() => {
    if (!isConnected) return
    let active = true
    for (const position of settled) {
      const key = positionKey(position)
      if (claimResults[key]?.ok) continue
      setPreflight((prev) =>
        prev[key]?.loading ? prev : { ...prev, [key]: { loading: true, ok: false } },
      )
      simulateClaim(position).then((verdict) => {
        if (!active) return
        setPreflight((prev) => ({
          ...prev,
          [key]: { loading: false, ok: verdict.ok, reason: verdict.reason },
        }))
      })
    }
    return () => {
      active = false
    }
    // settled membership is captured by the joined key list, so the pre-flight
    // re-runs when a position expires into the group or the list refetches.
  }, [settled.map(positionKey).join(','), isConnected])

  // Run the unwind pre-flight for each live position so the drawer can offer an
  // Unwind button only where the contract agrees the position can be sold back to
  // the AMM right now. Mirrors the claim pre-flight, on the live group. A position
  // already unwound this session is skipped (its result row stands).
  useEffect(() => {
    if (!isConnected) return
    let active = true
    for (const position of live) {
      const key = positionKey(position)
      if (unwindResults[key]?.ok) continue
      setUnwindPreflight((prev) =>
        prev[key]?.loading ? prev : { ...prev, [key]: { loading: true, ok: false } },
      )
      simulateRedeem(position).then((verdict) => {
        if (!active) return
        setUnwindPreflight((prev) => ({
          ...prev,
          [key]: { loading: false, ok: verdict.ok, reason: verdict.reason },
        }))
      })
    }
    return () => {
      active = false
    }
  }, [live.map(positionKey).join(','), isConnected])

  // Tab is trapped inside the dialog; Escape is handled at the document level above.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const root = dialogRef.current
    if (!root) return
    const focusable = root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const activeEl = document.activeElement
    if (e.shiftKey && (activeEl === first || activeEl === root)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && activeEl === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const handleClaim = async (position: ManagerPosition) => {
    const key = positionKey(position)
    if (claiming) return
    setClaiming(key)
    const result = await onClaim(position)
    setClaimResults((prev) => ({ ...prev, [key]: result }))
    setClaiming(null)
    // On a confirmed claim, drop the pre-flight verdict so the row shows the success
    // state rather than the now-stale Claim button.
    if (result.ok) {
      setPreflight((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const handleUnwind = async (position: ManagerPosition) => {
    const key = positionKey(position)
    if (unwinding) return
    setUnwinding(key)
    const result = await onRedeem(position)
    setUnwindResults((prev) => ({ ...prev, [key]: result }))
    setUnwinding(null)
    // On a confirmed unwind, drop the pre-flight verdict so the row shows the success
    // state rather than the now-stale Unwind button.
    if (result.ok) {
      setUnwindPreflight((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  // Render the Live and Settled sections for a given slice of positions. Shared by
  // the combined view (all positions) and the per-manager view (one manager's slice),
  // so a position row looks and behaves identically either way - the only difference
  // is which positions are passed in. Captures the per-position state and handlers so
  // each row keeps its pre-flight verdict, countdown, and claim/unwind affordance.
  const renderGroups = (liveSlice: ManagerPosition[], settledSlice: ManagerPosition[]) => (
    <>
      {liveSlice.length > 0 && (
        <Section title="Live" count={liveSlice.length}>
          {liveSlice.map((position) => {
            const key = positionKey(position)
            return (
              <PositionRow
                key={key}
                position={position}
                nowMs={nowMs}
                forward={forwardByOracle.get(position.oracleId) ?? null}
                unwindPreflight={unwindPreflight[key]}
                unwinding={unwinding === key}
                unwindResult={unwindResults[key]}
                onUnwind={() => handleUnwind(position)}
              />
            )
          })}
        </Section>
      )}

      {settledSlice.length > 0 && (
        <Section title="Settled" count={settledSlice.length}>
          {settledSlice.map((position) => {
            const key = positionKey(position)
            return (
              <PositionRow
                key={key}
                position={position}
                nowMs={nowMs}
                forward={forwardByOracle.get(position.oracleId) ?? null}
                preflight={preflight[key]}
                claiming={claiming === key}
                claimResult={claimResults[key]}
                onClaim={() => handleClaim(position)}
              />
            )
          })}
        </Section>
      )}
    </>
  )

  return (
    <>
      {/* Click-outside backdrop: closes the drawer. */}
      <div className="fixed inset-0 z-40 bg-black/40" aria-hidden="true" onClick={onClose} />

      <div
        ref={dialogRef}
        data-pc-studio-positions
        role="dialog"
        aria-modal="true"
        aria-label="Your positions"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="fixed inset-y-0 right-0 z-50 flex w-[22rem] max-w-[90vw] translate-x-0 flex-col border-l border-outline-variant bg-surface-container-lowest shadow-xl outline-none transition-transform motion-reduce:transition-none"
      >
        {/* Header. */}
        <div className="flex shrink-0 items-center justify-between border-b border-outline-variant px-md py-sm">
          <div className="flex flex-col">
            <span className="font-data text-data-sm text-on-surface">Positions</span>
            <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
              {asset} · from chain
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close positions"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-on-surface-variant outline-none transition-colors hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        {/* Body. */}
        <div className="flex min-h-0 flex-1 flex-col gap-md overflow-y-auto px-md py-sm">
          {!isConnected ? (
            <EmptyState
              icon="account_balance_wallet"
              title="Connect wallet"
              hint="Connect a wallet to see your positions and claim winnings."
              action={
                <button
                  type="button"
                  data-pc-studio-positions-connect
                  onClick={onConnect}
                  className="mt-1 rounded-sm bg-primary-fixed-dim px-md py-2 font-label text-label-caps uppercase tracking-wide text-on-primary-fixed outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset"
                >
                  Connect Wallet
                </button>
              }
            />
          ) : groups.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="No managers yet"
              hint="Create a PredictManager and mint a position; it will show up here."
            />
          ) : (
            <>
              {/* Roll-up: live count plus the settled breakdown by contract verdict.
                  Always across ALL managers, so the at-a-glance totals do not change
                  when the trader switches between the combined and per-manager views. */}
              <div className="flex flex-wrap gap-x-md gap-y-1 rounded-sm bg-surface-container-low px-sm py-2 font-data text-[11px] tabular-nums">
                <SummaryStat label="Live" value={live.length} tone="muted" />
                <SummaryStat label="Win" value={summary.claimable} tone="win" />
                <SummaryStat label="Claimed" value={summary.claimed} tone="muted" />
                <SummaryStat label="No payout" value={summary.noPayout} tone="loss" />
                {summary.checking > 0 && (
                  <SummaryStat label="Checking" value={summary.checking} tone="muted" />
                )}
              </div>

              {/* Manager controls, only when the wallet holds more than one. The drawer
                  lists managers separately by default (the trader sees which manager
                  holds what); this toggle folds them into one Live/Settled view. The
                  drawer never silently merges - combining is the trader's choice. */}
              {multiManager && (
                <div className="flex items-center justify-between gap-sm rounded-sm border border-outline-variant px-sm py-1.5 font-data text-[11px] text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                      account_tree
                    </span>
                    {groups.length} managers
                  </span>
                  <button
                    type="button"
                    data-pc-studio-positions-combine
                    aria-pressed={combineManagers}
                    onClick={() => setCombineManagers((prev) => !prev)}
                    className="rounded-sm border border-outline-variant px-sm py-1 font-label text-label-caps uppercase tracking-wide text-on-surface outline-none transition-colors hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset"
                  >
                    {combineManagers ? 'List separately' : 'Combine all'}
                  </button>
                </div>
              )}

              {showCombined ? (
                live.length === 0 && settled.length === 0 ? (
                  <span className="px-sm py-1 font-data text-[11px] text-on-surface-variant">
                    No positions yet. Mint from a heatmap cell.
                  </span>
                ) : (
                  renderGroups(live, settled)
                )
              ) : (
                groups.map((group) => {
                  const managerLive = group.positions.filter(
                    (p) => classifyPosition(p, nowMs) === 'live',
                  )
                  const managerSettled = group.positions.filter(
                    (p) => classifyPosition(p, nowMs) === 'expired',
                  )
                  return (
                    <div key={group.managerId} className="flex flex-col gap-sm">
                      <ManagerHeader group={group} />
                      {group.positions.length === 0 ? (
                        <span className="px-sm py-1 font-data text-[11px] text-on-surface-variant">
                          No positions in this manager.
                        </span>
                      ) : (
                        renderGroups(managerLive, managerSettled)
                      )}
                    </div>
                  )
                })
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center gap-sm">
        <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
          {title}
        </span>
        <span className="font-data text-[11px] tabular-nums text-on-surface-variant">{count}</span>
      </div>
      <div className="flex flex-col gap-px">{children}</div>
    </div>
  )
}

// A label for one PredictManager group when the drawer lists managers separately.
// The trader sees which manager holds which positions (and a short id) so they can
// tell the freshest manager from older ones before deciding to combine. The newest
// manager (index 0, the indexer read leads with it) is tagged so it is unmistakable.
// `partial` flags a manager whose indexer view erred and only an on-chain (open-only)
// read was possible, so the trader knows the settled history may be incomplete there.
function ManagerHeader({ group }: { group: ManagerGroup }) {
  const { managerId, index, partial, accountValue } = group
  const shortId = `${managerId.slice(0, 6)}...${managerId.slice(-4)}`
  return (
    <div className="flex flex-col gap-0.5 border-b border-outline-variant pb-1">
      <div className="flex items-center gap-sm">
        <span
          className="material-symbols-outlined text-[14px] text-on-surface-variant"
          aria-hidden="true"
        >
          account_balance_wallet
        </span>
        <span className="font-data text-[11px] tabular-nums text-on-surface">
          Manager {index + 1}
        </span>
        <span className="font-data text-[11px] tabular-nums text-on-surface-variant">
          {shortId}
        </span>
        {index === 0 && (
          <span className="ml-auto font-label text-label-caps uppercase tracking-wide text-primary-fixed-dim">
            newest
          </span>
        )}
      </div>
      <div className="flex items-center gap-sm pl-[22px] font-data text-[11px] tabular-nums text-on-surface-variant">
        {accountValue != null && <span>value {formatUsd(accountValue)}</span>}
        {partial && (
          <span className="flex items-center gap-0.5 text-tertiary-fixed-dim">
            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
              warning
            </span>
            open only
          </span>
        )}
      </div>
    </div>
  )
}

// One stat in the settled roll-up. Tone colors the figure to its meaning: a win is
// the primary accent, a no-payout is the error color, neutral counts stay muted.
function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'win' | 'loss' | 'muted'
}) {
  const valueColor =
    tone === 'win' ? 'text-primary-fixed-dim' : tone === 'loss' ? 'text-error' : 'text-on-surface'
  return (
    <span className="flex items-center gap-1">
      <span className="uppercase tracking-wide text-on-surface-variant">{label}</span>
      <span className={valueColor}>{value}</span>
    </span>
  )
}

function PositionRow({
  position,
  nowMs,
  forward,
  preflight,
  claiming = false,
  claimResult,
  onClaim,
  unwindPreflight,
  unwinding = false,
  unwindResult,
  onUnwind,
}: {
  position: ManagerPosition
  nowMs: number
  forward: number | null
  preflight?: PreflightState
  claiming?: boolean
  claimResult?: ClaimActionResult
  onClaim?: () => void
  unwindPreflight?: PreflightState
  unwinding?: boolean
  unwindResult?: ClaimActionResult
  onUnwind?: () => void
}) {
  const side = positionSideLabel(position)
  const strike = positionStrikeUsd(position)
  const moneyness = positionMoneyness(position, forward)
  const isLive = classifyPosition(position, nowMs) === 'live'
  const rule = positionOutcomeRule(position)
  const lean = positionLean(position, forward)

  return (
    <div className="flex flex-col gap-sm rounded-sm bg-surface-container-low px-sm py-2">
      <div className="flex items-start justify-between gap-sm">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <span
              className={`material-symbols-outlined text-[14px] ${
                side === 'UP' ? 'text-primary-fixed-dim' : 'text-error'
              }`}
              aria-hidden="true"
            >
              {side === 'UP' ? 'trending_up' : 'trending_down'}
            </span>
            <span className="font-data text-data-sm tabular-nums text-on-surface">
              {side ?? '-'} {strike != null ? formatUsd(strike) : '-'}
            </span>
          </div>
          <span className="font-data text-[11px] tabular-nums text-on-surface-variant">
            stake {position.quantity} DUSDC
            {moneyness != null ? ` · ${moneyness}` : ''}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {isLive ? (
            <>
              <span className="font-label text-label-caps uppercase tracking-wide text-primary-fixed-dim">
                live
              </span>
              <span className="font-data text-[11px] tabular-nums text-on-surface-variant">
                {formatCountdown(position.expiry, nowMs)}
              </span>
            </>
          ) : (
            <span className="font-label text-label-caps uppercase tracking-wide text-on-surface-variant">
              settled
            </span>
          )}
        </div>
      </div>

      {/* Plain-language payout rule, so a trader reads what the bet depends on
          without inferring it from UP/DOWN + a strike. A live position also shows
          where the current forward leans (not a prediction; the contract settles). */}
      {rule && (
        <div className="flex flex-col gap-0.5 border-t border-outline-variant pt-1.5 font-data text-[11px] text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span
              className="material-symbols-outlined text-[13px] text-primary-fixed-dim"
              aria-hidden="true"
            >
              check
            </span>
            <span>
              <span className="text-on-surface">Win</span> if {rule.winsWhen}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-error" aria-hidden="true">
              close
            </span>
            <span>
              <span className="text-on-surface">Lose</span> if {rule.losesWhen}
            </span>
          </span>
          {isLive && lean && (
            <span
              className={`mt-0.5 font-label text-label-caps uppercase tracking-wide ${
                lean === 'winning'
                  ? 'text-primary-fixed-dim'
                  : lean === 'losing'
                    ? 'text-error'
                    : 'text-on-surface-variant'
              }`}
            >
              {lean === 'winning'
                ? 'Now leaning win'
                : lean === 'losing'
                  ? 'Now leaning lose'
                  : 'At the strike'}
            </span>
          )}
        </div>
      )}

      {/* Claim affordance, settled rows only. */}
      {!isLive && (
        <ActionSlot
          preflight={preflight}
          busy={claiming}
          result={claimResult}
          onAction={onClaim}
          readyLabel="Claim"
          busyLabel="Claiming"
          doneLabel="Claimed"
          notReadyFallback="Nothing to claim."
          dataAttr="claim"
        />
      )}

      {/* Unwind affordance, live rows only: sell the position back to the AMM at the
          current fair value before expiry (predict::redeem). The pre-flight gates the
          button; the contract decides the proceeds. */}
      {isLive && (
        <ActionSlot
          preflight={unwindPreflight}
          busy={unwinding}
          result={unwindResult}
          onAction={onUnwind}
          readyLabel="Unwind position"
          busyLabel="Unwinding"
          doneLabel="Unwound"
          notReadyFallback="Cannot unwind right now."
          dataAttr="unwind"
          tone="neutral"
        />
      )}
    </div>
  )
}

// A contract-gated action slot shared by the settled claim and the live unwind. Both
// run a read-only devInspect pre-flight, then either show a signing button (when the
// contract agrees), a confirmed digest, an error, or the contract's read-only reason
// for why there is no button. Only the labels and the data attribute differ.
function ActionSlot({
  preflight,
  busy,
  result,
  onAction,
  readyLabel,
  busyLabel,
  doneLabel,
  notReadyFallback,
  dataAttr,
  tone = 'primary',
}: {
  preflight?: PreflightState
  busy: boolean
  result?: ClaimActionResult
  onAction?: () => void
  readyLabel: string
  busyLabel: string
  doneLabel: string
  notReadyFallback: string
  dataAttr: 'claim' | 'unwind'
  tone?: 'primary' | 'neutral'
}) {
  // A confirmed action wins over everything else: show the digest in place.
  if (result?.ok) {
    return (
      <div className="flex items-center gap-1 text-primary-fixed-dim" role="status">
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
          check_circle
        </span>
        <span className="font-label text-label-caps uppercase tracking-wide">{doneLabel}</span>
        {result.digest && (
          <a
            href={`${EXPLORER_TX}/${result.digest}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto break-all font-data text-[11px] text-primary-fixed-dim underline outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset"
          >
            {result.digest.slice(0, 12)}...
          </a>
        )}
      </div>
    )
  }

  if (result && !result.ok) {
    return (
      <span className="font-data text-[11px] text-error" role="alert">
        {result.error ?? 'Transaction failed'}
      </span>
    )
  }

  if (!preflight || preflight.loading) {
    return (
      <span className="flex items-center gap-1 font-data text-[11px] text-on-surface-variant">
        <span
          className="material-symbols-outlined animate-spin text-[14px] motion-reduce:animate-none"
          aria-hidden="true"
        >
          progress_activity
        </span>
        Checking
      </span>
    )
  }

  if (preflight.ok) {
    const buttonTone =
      tone === 'primary'
        ? 'bg-primary-fixed-dim text-on-primary-fixed hover:opacity-90'
        : 'border border-outline-variant text-on-surface hover:bg-surface-container'
    return (
      <button
        type="button"
        data-pc-studio-positions-claim={dataAttr === 'claim' ? '' : undefined}
        data-pc-studio-positions-unwind={dataAttr === 'unwind' ? '' : undefined}
        onClick={onAction}
        disabled={busy}
        className={`flex w-full items-center justify-center gap-sm rounded-sm px-sm py-1.5 font-label text-label-caps uppercase tracking-wide outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-40 ${buttonTone}`}
      >
        {busy ? (
          <>
            <span
              className="material-symbols-outlined animate-spin text-[14px] motion-reduce:animate-none"
              aria-hidden="true"
            >
              progress_activity
            </span>
            {busyLabel}
          </>
        ) : (
          readyLabel
        )}
      </button>
    )
  }

  // Pre-flight says not actionable: the contract's read, shown read-only so the
  // trader knows why there is no button.
  return (
    <span className="font-data text-[11px] text-on-surface-variant" role="status">
      {preflight.reason ?? notReadyFallback}
    </span>
  )
}

function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: string
  title: string
  hint: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-sm px-md py-xl text-center">
      <span
        className="material-symbols-outlined text-[28px] text-on-surface-variant"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="font-data text-data-sm text-on-surface">{title}</span>
      <span className="font-data text-[11px] text-on-surface-variant">{hint}</span>
      {action}
    </div>
  )
}
