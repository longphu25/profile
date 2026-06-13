import { useMemo, useRef, useState } from 'react'
import { usePredictClub } from '../usePredictClub'
import { selectOracle } from '../../infrastructure/deepbookOracleService'
import { OrderFlowChart } from '../OrderFlowChart'
import { formatCompactDusdc, formatUsd } from '../shared'
import { formatProbabilityLabel } from '../display'
import type { Direction } from '../../domain/types'

/**
 * THROWAWAY prototype — Variant A: "Swipe Deck" (chart-backed, one-tap).
 *
 * The live OrderFlow chart fills the background (non-interactive, dimmed); a
 * translucent oracle card floats on top — swipe it to switch oracle. The key
 * economics stay visible (no extra tap), and the two big UP/DOWN buttons submit
 * the trade immediately: tapping UP calls executeRound('UP'), DOWN calls
 * executeRound('DOWN') — no separate "pick then submit" step. All data is real
 * (usePredictClub + selectOracle). Delete when a direction is chosen.
 */

export function VariantA() {
  const { oracleSnapshot, pricingSnapshot, primaryAction, riskEvaluation, context, actions } =
    usePredictClub()
  const oracles = useMemo(
    () => oracleSnapshot.oracles.filter((o) => o.status === 'active'),
    [oracleSnapshot.oracles],
  )
  const selectedIdx = Math.max(
    0,
    oracles.findIndex((o) => o.oracle_id === oracleSnapshot.selectedOracleId),
  )
  const [idx, setIdx] = useState(selectedIdx)
  const [submitting, setSubmitting] = useState<Direction | null>(null)
  const touchX = useRef<number | null>(null)

  const active = oracles[idx]
  const spot = oracleSnapshot.oracleState?.latest_price?.spot ?? 0
  const forward = oracleSnapshot.oracleState?.latest_price?.forward ?? 0
  const quote = pricingSnapshot.quote
  const fair = pricingSnapshot.fairValue
  const blocked = !riskEvaluation.canExecute
  const blockingReason = riskEvaluation.blockingReasons[0]?.message

  function go(delta: number) {
    if (oracles.length === 0) return
    const next = (idx + delta + oracles.length) % oracles.length
    setIdx(next)
    const target = oracles[next]
    if (target) selectOracle(target.oracle_id)
  }

  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0]?.clientX ?? null
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current
    if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1)
    touchX.current = null
  }

  async function submit(dir: Direction) {
    if (submitting) return
    setSubmitting(dir)
    try {
      await actions.executeRound(dir)
    } finally {
      setSubmitting(null)
    }
  }

  if (oracles.length === 0) {
    return (
      <Screen prices={oracleSnapshot.prices}>
        <div className="flex flex-1 items-center justify-center text-center">
          <p className="font-data text-data-sm text-on-surface-variant/60">
            No active oracles right now. Check back shortly.
          </p>
        </div>
      </Screen>
    )
  }

  return (
    <Screen prices={oracleSnapshot.prices}>
      {/* Oracle position dots */}
      <div className="flex items-center justify-center gap-1.5 pt-1 pb-2" aria-hidden="true">
        {oracles.map((o, i) => (
          <span
            key={o.oracle_id}
            className={[
              'h-1.5 rounded-full transition-all',
              i === idx ? 'w-5 bg-primary-fixed-dim' : 'w-1.5 bg-on-surface-variant/40',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Swipeable oracle card — floats over the chart */}
      <div
        className="relative flex-1 select-none px-1"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-outline-variant/60 bg-surface-container-lowest/70 p-6 shadow-xl backdrop-blur-md">
          {/* arrows for non-touch */}
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous oracle"
            className="material-symbols-outlined absolute left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface-container/80 text-on-surface-variant lg:flex"
          >
            chevron_left
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next oracle"
            className="material-symbols-outlined absolute right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface-container/80 text-on-surface-variant lg:flex"
          >
            chevron_right
          </button>

          {/* Header: asset + expiry */}
          <div>
            <span className="font-label text-label-caps uppercase tracking-widest text-on-surface-variant/80">
              {active?.underlying_asset ?? 'Oracle'} · settles {formatExpiry(active?.expiry)}
            </span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-headline text-[2.75rem] font-black leading-none text-on-surface tabular-nums">
                ${formatUsd(spot)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 font-data text-data-sm text-on-surface-variant">
              <span>Forward ${formatUsd(forward)}</span>
              <span className="text-primary-fixed-dim">
                {formatProbabilityLabel(fair.probability, {
                  degraded: fair.degraded,
                  reason: fair.reason,
                })}
              </span>
            </div>
          </div>

          {/* Economics strip — always visible, no extra tap */}
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Est. cost" value={`-${formatCompactDusdc(quote.estimatedCost ?? 0)}`} />
            <Stat label="Payout if win" value={formatCompactDusdc(quote.grossIfWin)} tone="mint" />
          </div>
        </div>
      </div>

      {/* One-tap UP / DOWN — distinct colors, submit on click */}
      {!context.isConnected ? (
        <button
          type="button"
          data-pc-action="connect"
          onClick={primaryAction.action}
          className="mt-3 h-16 w-full rounded-2xl bg-primary-fixed-dim font-headline text-headline-md text-on-primary-fixed"
        >
          Connect Wallet
        </button>
      ) : (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-3 px-1">
            <SubmitButton
              dir="UP"
              spot={spot}
              submitting={submitting === 'UP'}
              disabled={submitting !== null || blocked}
              onClick={() => submit('UP')}
            />
            <SubmitButton
              dir="DOWN"
              spot={spot}
              submitting={submitting === 'DOWN'}
              disabled={submitting !== null || blocked}
              onClick={() => submit('DOWN')}
            />
          </div>
          {blocked && blockingReason && (
            <p className="mt-1.5 text-center font-data text-[11px] text-error">{blockingReason}</p>
          )}
        </div>
      )}
    </Screen>
  )
}

function Screen({
  children,
  prices,
}: {
  children: React.ReactNode
  prices: React.ComponentProps<typeof OrderFlowChart>['prices']
}) {
  return (
    <div
      data-pc-variant="A"
      className="relative mx-auto flex h-full w-full max-w-[28rem] flex-col overflow-hidden px-4 pb-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))]"
    >
      {/* Chart background — non-interactive, dimmed underlay */}
      <div data-pc-chart-bg className="pointer-events-none absolute inset-0 opacity-40">
        <OrderFlowChart prices={prices} />
      </div>
      {/* Legibility scrim */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/40 via-background/10 to-background" />
      {/* Foreground */}
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  )
}

function SubmitButton({
  dir,
  spot,
  submitting,
  disabled,
  onClick,
}: {
  dir: Direction
  spot: number
  submitting: boolean
  disabled: boolean
  onClick: () => void
}) {
  const up = dir === 'UP'
  return (
    <button
      type="button"
      data-pc-action={up ? 'submit-up' : 'submit-down'}
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex h-20 flex-col items-center justify-center gap-0.5 rounded-2xl font-headline transition-all active:scale-[0.97]',
        disabled && !submitting
          ? 'bg-surface-variant text-on-surface-variant opacity-60'
          : up
            ? 'bg-primary-fixed-dim text-on-primary-fixed glow-mint'
            : 'bg-error text-on-error',
      ].join(' ')}
    >
      <span className="material-symbols-outlined text-[30px]">
        {submitting ? 'progress_activity' : up ? 'trending_up' : 'trending_down'}
      </span>
      <span className="text-headline-md font-black">{up ? 'UP' : 'DOWN'}</span>
      <span className="font-data text-[10px] uppercase opacity-80">
        {submitting ? 'submitting…' : `${up ? 'above' : 'below'} $${formatUsd(spot)}`}
      </span>
    </button>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'mint' }) {
  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container/50 px-3 py-2">
      <div className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant/70">
        {label}
      </div>
      <div
        className={[
          'mt-0.5 font-data text-data-md font-bold tabular-nums',
          tone === 'mint' ? 'text-primary-fixed-dim' : 'text-on-surface',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  )
}

function formatExpiry(ms?: number): string {
  if (!ms) return '—'
  const diff = ms - Date.now()
  if (diff <= 0) return 'now'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
