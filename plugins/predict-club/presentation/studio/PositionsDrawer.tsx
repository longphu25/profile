import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import type { ManagerPosition } from '../../infrastructure/deepbookPredictPricingService'
import {
  classifyPosition,
  positionKey,
  positionMoneyness,
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
  positions,
  isConnected,
  forwardByOracle,
  asset = 'BTC',
  simulateClaim,
  onClaim,
  onConnect,
  onClose,
}: {
  positions: ManagerPosition[]
  isConnected: boolean
  forwardByOracle: Map<string, number>
  asset?: string
  simulateClaim: (position: ManagerPosition) => Promise<{ ok: boolean; reason?: string }>
  onClaim: (position: ManagerPosition) => Promise<ClaimActionResult>
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
  // A 1s tick so live countdowns advance while the drawer is open. Only armed when
  // there is at least one live position, so a settled-only list stays idle.
  const [nowMs, setNowMs] = useState(() => Date.now())

  const live = positions.filter((p) => classifyPosition(p, nowMs) === 'live')
  const settled = positions.filter((p) => classifyPosition(p, nowMs) === 'expired')

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
          ) : positions.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="No positions yet"
              hint="Mint a position from a heatmap cell and it will show up here."
            />
          ) : (
            <>
              {live.length > 0 && (
                <Section title="Live" count={live.length}>
                  {live.map((position) => (
                    <PositionRow
                      key={positionKey(position)}
                      position={position}
                      nowMs={nowMs}
                      forward={forwardByOracle.get(position.oracleId) ?? null}
                    />
                  ))}
                </Section>
              )}

              {settled.length > 0 && (
                <Section title="Settled" count={settled.length}>
                  {settled.map((position) => {
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

function PositionRow({
  position,
  nowMs,
  forward,
  preflight,
  claiming = false,
  claimResult,
  onClaim,
}: {
  position: ManagerPosition
  nowMs: number
  forward: number | null
  preflight?: PreflightState
  claiming?: boolean
  claimResult?: ClaimActionResult
  onClaim?: () => void
}) {
  const side = positionSideLabel(position)
  const strike = positionStrikeUsd(position)
  const moneyness = positionMoneyness(position, forward)
  const isLive = classifyPosition(position, nowMs) === 'live'

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

      {/* Claim affordance, settled rows only. */}
      {!isLive && (
        <ClaimSlot
          preflight={preflight}
          claiming={claiming}
          claimResult={claimResult}
          onClaim={onClaim}
        />
      )}
    </div>
  )
}

function ClaimSlot({
  preflight,
  claiming,
  claimResult,
  onClaim,
}: {
  preflight?: PreflightState
  claiming: boolean
  claimResult?: ClaimActionResult
  onClaim?: () => void
}) {
  // A confirmed claim wins over everything else: show the digest in place.
  if (claimResult?.ok) {
    return (
      <div className="flex items-center gap-1 text-primary-fixed-dim" role="status">
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
          check_circle
        </span>
        <span className="font-label text-label-caps uppercase tracking-wide">Claimed</span>
        {claimResult.digest && (
          <a
            href={`${EXPLORER_TX}/${claimResult.digest}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto break-all font-data text-[11px] text-primary-fixed-dim underline outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset"
          >
            {claimResult.digest.slice(0, 12)}...
          </a>
        )}
      </div>
    )
  }

  if (claimResult && !claimResult.ok) {
    return (
      <span className="font-data text-[11px] text-error" role="alert">
        {claimResult.error ?? 'Claim failed'}
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
    return (
      <button
        type="button"
        data-pc-studio-positions-claim
        onClick={onClaim}
        disabled={claiming}
        className="flex w-full items-center justify-center gap-sm rounded-sm bg-primary-fixed-dim px-sm py-1.5 font-label text-label-caps uppercase tracking-wide text-on-primary-fixed outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-40"
      >
        {claiming ? (
          <>
            <span
              className="material-symbols-outlined animate-spin text-[14px] motion-reduce:animate-none"
              aria-hidden="true"
            >
              progress_activity
            </span>
            Claiming
          </>
        ) : (
          'Claim'
        )}
      </button>
    )
  }

  // Pre-flight says not claimable: the contract's read (lost / unsettled / already
  // claimed), shown read-only so the trader knows why there is no button.
  return (
    <span className="font-data text-[11px] text-on-surface-variant" role="status">
      {preflight.reason ?? 'Nothing to claim.'}
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
