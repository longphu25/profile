import { type KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { computeFairValue } from '../../domain/payoutPreview'
import type { AssetBalances } from '../../domain/types'
import type { MispriceCell, SurfaceCell, SurfaceColumn } from '../../domain/volSurface'
import { recommendDirection } from '../../application/submitStudioTrade'

/**
 * Trade ticket popover (plan 23, S7): mint a personal binary position straight
 * from a heatmap cell.
 *
 * A trader clicks a cell (a strike x expiry) and this popover anchors to it. It is
 * decision-support, not advice: it shows the model fair win-probability (always,
 * from SVI) and the contract-implied probability + edge when the cell sits in the
 * quoted ATM band, and highlights the side the model sees value on - but the user
 * always picks UP or DOWN themselves. No payout is fabricated; only the stake and
 * model probability are shown.
 *
 * Presentational: it owns the local form state (direction, size) and the submit
 * lifecycle (idle -> submitting -> success/error), but the actual gate -> build ->
 * sign pipeline is injected via `onSubmit` so this stays unit-friendly and never
 * touches the wallet host directly. `onConnect` is the disconnected path.
 */

const SIZE_CHIPS = [10, 25, 50]
const EXPLORER_TX = 'https://suiscan.xyz/testnet/tx'

export interface TradeTicketResult {
  ok: boolean
  digest?: string
  error?: string
}

function formatUsd(value: number): string {
  return value >= 1000 ? `$${Math.round(value).toLocaleString('en-US')}` : `$${value}`
}

function formatExpiry(secondsToExpiry: number): string {
  const s = Math.max(0, secondsToExpiry)
  if (s < 3600) return `${Math.round(s / 60)}m`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

function fmtProb(p: number | null): string {
  return p == null ? '-' : `${(p * 100).toFixed(1)}%`
}

export function TradeTicket({
  cell,
  column,
  mispriceCell,
  balances,
  isConnected,
  managerReady,
  anchorRect,
  asset = 'BTC',
  onConnect,
  onSubmit,
  onClose,
}: {
  cell: SurfaceCell
  column: SurfaceColumn
  mispriceCell?: MispriceCell
  balances: AssetBalances
  isConnected: boolean
  managerReady: boolean
  anchorRect: DOMRect | null
  asset?: string
  onConnect: () => void
  onSubmit: (direction: 'UP' | 'DOWN', amountDusdc: number) => Promise<TradeTicketResult>
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const [direction, setDirection] = useState<'UP' | 'DOWN'>('UP')
  const [amount, setAmount] = useState<number>(10)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<TradeTicketResult | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Model fair win-probability for the UP side (always available unless degraded).
  // The DOWN side is its complement. This is pure SVI math over data we already hold.
  const fairUp = useMemo<number | null>(() => {
    if (column.degraded || !column.svi || column.forward <= 0) return null
    const p = computeFairValue(column.svi, column.forward, column.expiryMs, cell.strike, 0)
    return Number.isFinite(p) && p > 0 ? p : null
  }, [column.degraded, column.svi, column.forward, column.expiryMs, cell.strike])

  const contractUp = mispriceCell?.contractProbability ?? null
  const recommended = recommendDirection(fairUp, contractUp)

  const selectedFair = direction === 'UP' ? fairUp : fairUp != null ? 1 - fairUp : null
  const selectedContract =
    direction === 'UP' ? contractUp : contractUp != null ? 1 - contractUp : null

  // Position the popover next to the clicked cell, clamped to the viewport. Measured
  // after mount so we know our own size; falls back to centered when no anchor.
  useLayoutEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (!anchorRect) {
      setPos({ top: Math.max(margin, (vh - height) / 2), left: Math.max(margin, (vw - width) / 2) })
      return
    }
    let left = anchorRect.right + margin
    if (left + width > vw - margin) left = anchorRect.left - width - margin
    if (left < margin) left = Math.min(Math.max(margin, anchorRect.left), vw - width - margin)
    let top = anchorRect.top
    if (top + height > vh - margin) top = vh - height - margin
    if (top < margin) top = margin
    setPos({ top, left })
  }, [anchorRect])

  // Focus the dialog on mount so Tab is trapped from the start.
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  // Escape closes from anywhere - a mouse user who clicked a cell has no focus
  // inside the popover, so a dialog-scoped handler would miss it. keydown is a
  // composed event, so this fires even though the studio lives in a shadow root.
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

  const overBalance = amount > balances.dusdc
  const amountValid = amount > 0 && !overBalance
  const blockReason = !isConnected
    ? null
    : !managerReady
      ? 'Create a PredictManager first'
      : overBalance
        ? `Need ${amount} DUSDC, have ${balances.dusdc}`
        : amount <= 0
          ? 'Enter a stake above 0'
          : null

  const handleSubmit = async () => {
    if (submitting || !amountValid) return
    setSubmitting(true)
    setResult(null)
    const r = await onSubmit(direction, amount)
    setResult(r)
    setSubmitting(false)
  }

  return (
    <>
      {/* Click-outside backdrop (transparent): closes the ticket. */}
      <div className="fixed inset-0 z-40" aria-hidden="true" onClick={onClose} />

      <div
        ref={dialogRef}
        data-pc-studio-ticket
        role="dialog"
        aria-modal="true"
        aria-label={`Trade ${asset} ${formatUsd(cell.strike)} at ${formatExpiry(column.secondsToExpiry)}`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
        className="fixed z-50 flex w-[19rem] flex-col gap-sm rounded-md border border-outline-variant bg-surface-container-lowest p-md shadow-xl outline-none"
      >
        {/* Header. */}
        <div className="flex items-start justify-between gap-sm">
          <div className="flex flex-col">
            <span className="font-data text-data-sm text-on-surface">
              {asset} above {formatUsd(cell.strike)}?
            </span>
            <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
              settles in {formatExpiry(column.secondsToExpiry)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trade ticket"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-on-surface-variant outline-none transition-colors hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        {result?.ok ? (
          <SuccessView digest={result.digest} onClose={onClose} />
        ) : (
          <>
            {/* UP / DOWN toggle, recommended side flagged. */}
            <div className="grid grid-cols-2 gap-sm">
              {(['UP', 'DOWN'] as const).map((dir) => {
                const active = direction === dir
                const isRec = recommended === dir
                return (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => setDirection(dir)}
                    aria-pressed={active}
                    className={`relative flex flex-col items-center gap-0.5 rounded-sm px-sm py-2 font-label text-label-caps uppercase tracking-wide outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset ${
                      active
                        ? dir === 'UP'
                          ? 'bg-primary-fixed-dim text-on-primary-fixed'
                          : 'bg-error text-on-surface'
                        : 'bg-surface-container text-on-surface hover:bg-surface-bright'
                    } ${isRec && !active ? 'ring-1 ring-primary-fixed-dim ring-inset' : ''}`}
                  >
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                        {dir === 'UP' ? 'trending_up' : 'trending_down'}
                      </span>
                      {dir}
                    </span>
                    {isRec && (
                      <span className="font-label text-[9px] normal-case tracking-normal opacity-90">
                        model sees value
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Probability read-out: fair (model) always, contract when quoted. */}
            <div className="flex flex-col gap-px rounded-sm bg-outline-variant">
              <div className="flex items-center justify-between bg-surface-container-lowest px-sm py-1">
                <span className="font-label text-label-caps uppercase tracking-wide text-on-surface-variant">
                  Model fair
                </span>
                <span className="font-data text-data-sm tabular-nums text-on-surface">
                  {fmtProb(selectedFair)}
                </span>
              </div>
              <div className="flex items-center justify-between bg-surface-container-lowest px-sm py-1">
                <span className="font-label text-label-caps uppercase tracking-wide text-on-surface-variant">
                  Contract
                </span>
                <span className="font-data text-data-sm tabular-nums text-on-surface-variant">
                  {selectedContract == null ? 'not quoted' : fmtProb(selectedContract)}
                </span>
              </div>
            </div>

            {/* Size input + quick chips. */}
            <div className="flex flex-col gap-sm">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="pc-studio-size"
                  className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant"
                >
                  Stake (DUSDC)
                </label>
                <span className="font-data text-[11px] tabular-nums text-on-surface-variant">
                  bal {balances.dusdc}
                </span>
              </div>
              <div className="flex items-center gap-sm">
                <input
                  id="pc-studio-size"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={Number.isFinite(amount) ? amount : ''}
                  onChange={(e) => setAmount(Number(e.currentTarget.value))}
                  className={`w-full rounded-sm border bg-surface-container px-sm py-1 font-data text-data-sm tabular-nums text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset ${
                    overBalance ? 'border-error' : 'border-outline-variant'
                  }`}
                />
                <div className="flex shrink-0 gap-1">
                  {SIZE_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setAmount(chip)}
                      className="rounded-sm bg-surface-container px-sm py-1 font-data text-[11px] tabular-nums text-on-surface outline-none transition-colors hover:bg-surface-bright focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action / state. */}
            {!isConnected ? (
              <button
                type="button"
                data-pc-studio-ticket-connect
                onClick={onConnect}
                className="mt-1 w-full rounded-sm bg-primary-fixed-dim px-sm py-2 font-label text-label-caps uppercase tracking-wide text-on-primary-fixed outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset"
              >
                Connect Wallet
              </button>
            ) : (
              <>
                <button
                  type="button"
                  data-pc-studio-ticket-submit
                  onClick={handleSubmit}
                  disabled={submitting || !amountValid}
                  className="mt-1 flex w-full items-center justify-center gap-sm rounded-sm bg-primary-fixed-dim px-sm py-2 font-label text-label-caps uppercase tracking-wide text-on-primary-fixed outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? (
                    <>
                      <span
                        className="material-symbols-outlined animate-spin text-[16px] motion-reduce:animate-none"
                        aria-hidden="true"
                      >
                        progress_activity
                      </span>
                      Submitting
                    </>
                  ) : (
                    `Submit ${direction} - stake ${amountValid ? amount : 0} DUSDC`
                  )}
                </button>
                {blockReason && (
                  <span className="font-data text-[11px] text-error" role="status">
                    {blockReason}
                  </span>
                )}
                {result && !result.ok && (
                  <span className="font-data text-[11px] text-error" role="alert">
                    {result.error ?? 'Submit failed'}
                  </span>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}

function SuccessView({ digest, onClose }: { digest?: string; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-sm" role="status">
      <div className="flex items-center gap-sm text-primary-fixed-dim">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          check_circle
        </span>
        <span className="font-label text-label-caps uppercase tracking-wide">Position minted</span>
      </div>
      {digest && (
        <a
          href={`${EXPLORER_TX}/${digest}`}
          target="_blank"
          rel="noreferrer"
          className="break-all font-data text-[11px] text-primary-fixed-dim underline outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset"
        >
          {digest.slice(0, 16)}...
        </a>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-1 w-full rounded-sm bg-surface-container px-sm py-2 font-label text-label-caps uppercase tracking-wide text-on-surface outline-none transition-colors hover:bg-surface-bright focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset"
      >
        Done
      </button>
    </div>
  )
}
