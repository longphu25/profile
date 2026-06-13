import { useMemo, useRef, useState } from 'react'
import { usePredictClub } from '../usePredictClub'
import { selectOracle } from '../../infrastructure/deepbookOracleService'
import { OrderFlowChart } from '../OrderFlowChart'
import { formatCompactDusdc, formatUsd } from '../shared'
import { formatProbabilityLabel } from '../display'
import type { Direction } from '../../domain/types'

/**
 * THROWAWAY prototype — Variant A: "Swipe Deck" (chart-hero, one-tap).
 *
 * The live OrderFlow chart is the visible hero (full opacity, framed), not a
 * dimmed backdrop. A swipeable oracle chip rail + price headline sit above it,
 * an economics strip below it, and two big distinct-color UP/DOWN buttons submit
 * the trade in one tap: UP → executeRound('UP'), DOWN → executeRound('DOWN').
 * No separate "pick then submit". All data is real (usePredictClub +
 * selectOracle). Delete when a direction is chosen.
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
  const [submitting, setSubmitting] = useState<Direction | null>(null)
  const touchX = useRef<number | null>(null)

  const spot = oracleSnapshot.oracleState?.latest_price?.spot ?? 0
  const forward = oracleSnapshot.oracleState?.latest_price?.forward ?? 0
  const quote = pricingSnapshot.quote
  const fair = pricingSnapshot.fairValue
  const blocked = !riskEvaluation.canExecute
  const blockingReason = riskEvaluation.blockingReasons[0]?.message

  function go(delta: number) {
    if (oracles.length === 0) return
    const next = (selectedIdx + delta + oracles.length) % oracles.length
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
      <Screen>
        <div className="flex flex-1 items-center justify-center text-center">
          <p className="font-data text-data-sm text-on-surface-variant/60">
            No active oracles right now. Check back shortly.
          </p>
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      {/* Oracle chip rail — tap or swipe the chart to switch */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
        {oracles.map((o) => {
          const sel = o.oracle_id === oracleSnapshot.selectedOracleId
          return (
            <button
              key={o.oracle_id}
              type="button"
              onClick={() => selectOracle(o.oracle_id)}
              className={[
                'shrink-0 rounded-full border px-3 py-1.5 font-data text-data-sm transition-colors',
                sel
                  ? 'border-primary-fixed-dim bg-primary-fixed-dim/15 text-primary-fixed-dim'
                  : 'border-outline-variant bg-surface-container text-on-surface-variant',
              ].join(' ')}
            >
              {o.underlying_asset}
              <span className="ml-1.5 opacity-60">{formatExpiry(o.expiry)}</span>
            </button>
          )
        })}
      </div>

      {/* Price headline */}
      <div className="flex items-end justify-between">
        <div>
          <div className="font-headline text-[2.5rem] font-black leading-none text-on-surface tabular-nums">
            ${formatUsd(spot)}
          </div>
          <div className="mt-1 font-data text-data-sm text-on-surface-variant">
            Forward ${formatUsd(forward)}
          </div>
        </div>
        <span className="rounded-full bg-primary-fixed-dim/12 px-2.5 py-1 font-label text-label-caps uppercase tracking-wide text-primary-fixed-dim">
          {formatProbabilityLabel(fair.probability, {
            degraded: fair.degraded,
            reason: fair.reason,
          })}
        </span>
      </div>

      {/* Chart hero — visible, framed, swipe to change oracle */}
      <div
        data-pc-chart-bg
        className="relative min-h-[180px] flex-1 select-none overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <OrderFlowChart prices={oracleSnapshot.prices} />
        {oracles.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous oracle"
              className="material-symbols-outlined absolute left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface-container/85 text-on-surface-variant lg:flex"
            >
              chevron_left
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next oracle"
              className="material-symbols-outlined absolute right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface-container/85 text-on-surface-variant lg:flex"
            >
              chevron_right
            </button>
          </>
        )}
      </div>

      {/* Economics strip — always visible, no extra tap */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Est. cost" value={`-${formatCompactDusdc(quote.estimatedCost ?? 0)}`} />
        <Stat label="Payout if win" value={formatCompactDusdc(quote.grossIfWin)} tone="mint" />
      </div>

      {/* One-tap UP / DOWN — distinct colors, submit on click */}
      {!context.isConnected ? (
        <button
          type="button"
          data-pc-action="connect"
          onClick={primaryAction.action}
          className="h-16 w-full rounded-2xl bg-primary-fixed-dim font-headline text-headline-md font-black text-on-primary-fixed transition-transform active:scale-[0.98]"
        >
          Connect Wallet
        </button>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-3">
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

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-pc-variant="A"
      className="mx-auto flex h-full w-full max-w-[28rem] flex-col gap-3 overflow-hidden bg-background px-4 pt-3 pb-[5.5rem]"
    >
      {children}
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
        'flex h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl font-headline transition-all active:scale-[0.97]',
        disabled && !submitting
          ? 'bg-surface-variant text-on-surface-variant opacity-60'
          : up
            ? 'bg-primary-fixed-dim text-on-primary-fixed'
            : 'bg-[#ff5d73] text-[#2a0008]',
      ].join(' ')}
    >
      <span className="material-symbols-outlined text-[28px]">
        {submitting ? 'progress_activity' : up ? 'trending_up' : 'trending_down'}
      </span>
      <span className="text-headline-md font-black leading-none">{up ? 'UP' : 'DOWN'}</span>
      <span className="font-data text-[10px] font-bold uppercase opacity-80">
        {submitting ? 'submitting…' : `${up ? 'above' : 'below'} $${formatUsd(spot)}`}
      </span>
    </button>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'mint' }) {
  return (
    <div className="rounded-xl border border-outline-variant/50 bg-surface-container/60 px-3 py-2">
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
  if (!ms) return '-'
  const diff = ms - Date.now()
  if (diff <= 0) return 'now'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
