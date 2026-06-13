import { useEffect, useMemo, useRef, useState } from 'react'
import { usePredictClub } from '../usePredictClub'
import { selectOracle } from '../../infrastructure/deepbookOracleService'
import { formatCompactDusdc, formatUsd } from '../shared'
import { formatProbabilityLabel } from '../display'
import type { Direction } from '../../domain/types'

/**
 * THROWAWAY prototype — Variant A: "Swipe Deck" (side-peek carousel, one-tap).
 *
 * A real horizontal snap-carousel of oracle cards: the centered card is the
 * selected oracle and shows live data (price, a SIMPLE inline sparkline, payout);
 * the neighbours peek at the edges showing just asset + expiry until swiped in.
 * Scrolling a new card to center calls selectOracle, so its live data fills in.
 * Two distinct-color UP/DOWN buttons submit in one tap: UP → executeRound('UP'),
 * DOWN → executeRound('DOWN'). All data is real. Delete when a direction is chosen.
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

  const [active, setActive] = useState(selectedIdx)
  const [submitting, setSubmitting] = useState<Direction | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLElement | null)[]>([])
  const activeRef = useRef(active)
  activeRef.current = active

  const spot = oracleSnapshot.oracleState?.latest_price?.spot ?? 0
  const forward = oracleSnapshot.oracleState?.latest_price?.forward ?? 0
  const quote = pricingSnapshot.quote
  const fair = pricingSnapshot.fairValue
  const spotSeries = useMemo(
    () => oracleSnapshot.prices.map((p) => p.spot),
    [oracleSnapshot.prices],
  )
  const blocked = !riskEvaluation.canExecute
  const blockingReason = riskEvaluation.blockingReasons[0]?.message

  // Detect the centered card and adopt it as the selected oracle.
  useEffect(() => {
    const root = scrollRef.current
    if (!root || oracles.length === 0) return
    const ratios = new Map<number, number>()
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.idx)
          ratios.set(i, e.intersectionRatio)
        }
        let best = activeRef.current
        let bestRatio = -1
        ratios.forEach((r, i) => {
          if (r > bestRatio) {
            bestRatio = r
            best = i
          }
        })
        if (best !== activeRef.current) {
          activeRef.current = best
          setActive(best)
          const target = oracles[best]
          if (target) selectOracle(target.oracle_id)
        }
      },
      { root, threshold: [0.25, 0.5, 0.75, 1] },
    )
    for (const el of cardRefs.current) if (el) obs.observe(el)
    return () => obs.disconnect()
  }, [oracles])

  // Center the initially-selected card without animating on first paint.
  useEffect(() => {
    cardRefs.current[selectedIdx]?.scrollIntoView({ inline: 'center', block: 'nearest' })
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function scrollToCard(i: number) {
    cardRefs.current[i]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
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
      {/* Side-peek carousel */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          data-pc-chart-bg
          className="flex h-full snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-[10%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {oracles.map((o, i) => (
            <article
              key={o.oracle_id}
              data-idx={i}
              ref={(el) => {
                cardRefs.current[i] = el
              }}
              className={[
                'flex w-[80%] shrink-0 snap-center flex-col rounded-3xl border p-5 transition-all duration-300',
                i === active
                  ? 'border-primary-fixed-dim/50 bg-surface-container-low shadow-[0_0_40px_-12px_rgba(0,224,179,0.5)]'
                  : 'scale-[0.94] border-outline-variant/60 bg-surface-container-lowest opacity-60',
              ].join(' ')}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="font-headline text-headline-md font-black text-on-surface">
                  {o.underlying_asset}
                </span>
                <span className="rounded-full border border-outline-variant/70 px-2.5 py-1 font-data text-[11px] text-on-surface-variant">
                  {formatExpiry(o.expiry)}
                </span>
              </div>

              {i === active ? (
                <>
                  {/* Spot price */}
                  <div className="mt-4 font-data text-[2.75rem] font-black leading-none tracking-tight text-on-surface tabular-nums">
                    ${formatUsd(spot)}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 font-data text-data-sm">
                    <span className="text-on-surface-variant">Fwd ${formatUsd(forward)}</span>
                    <span className="ml-auto rounded-full bg-primary-fixed-dim/15 px-2 py-0.5 font-label text-label-caps uppercase tracking-wide text-primary-fixed-dim">
                      {formatProbabilityLabel(fair.probability, {
                        degraded: fair.degraded,
                        reason: fair.reason,
                      })}
                    </span>
                  </div>

                  {/* Simple sparkline */}
                  <Sparkline values={spotSeries} className="mt-4 flex-1" />

                  {/* Economics */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Stat
                      label="Est. cost"
                      value={`-${formatCompactDusdc(quote.estimatedCost ?? 0)}`}
                    />
                    <Stat
                      label="Payout if win"
                      value={formatCompactDusdc(quote.grossIfWin)}
                      tone="mint"
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                  <span className="material-symbols-outlined text-[28px] text-on-surface-variant/40">
                    swipe
                  </span>
                  <span className="font-data text-[11px] uppercase tracking-wide text-on-surface-variant/50">
                    Swipe to load
                  </span>
                </div>
              )}
            </article>
          ))}
        </div>

        {/* Desktop arrows */}
        {oracles.length > 1 && (
          <>
            {active > 0 && (
              <button
                type="button"
                onClick={() => scrollToCard(active - 1)}
                aria-label="Previous oracle"
                className="material-symbols-outlined absolute left-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface-container/90 text-on-surface-variant shadow-lg lg:flex"
              >
                chevron_left
              </button>
            )}
            {active < oracles.length - 1 && (
              <button
                type="button"
                onClick={() => scrollToCard(active + 1)}
                aria-label="Next oracle"
                className="material-symbols-outlined absolute right-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface-container/90 text-on-surface-variant shadow-lg lg:flex"
              >
                chevron_right
              </button>
            )}
          </>
        )}
      </div>

      {/* Position dots */}
      {oracles.length > 1 && (
        <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
          {oracles.map((o, i) => (
            <span
              key={o.oracle_id}
              className={[
                'h-1.5 rounded-full transition-all',
                i === active ? 'w-5 bg-primary-fixed-dim' : 'w-1.5 bg-on-surface-variant/30',
              ].join(' ')}
            />
          ))}
        </div>
      )}

      {/* One-tap UP / DOWN */}
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
      className="mx-auto flex h-full w-full max-w-[28rem] flex-col gap-3 overflow-hidden bg-background px-4 pt-4 pb-[5.5rem]"
    >
      {children}
    </div>
  )
}

/** Minimal SVG sparkline of recent spot prices — line + soft area fill. */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-surface-container-lowest/60 ${className ?? ''}`}
      >
        <span className="font-data text-[11px] text-on-surface-variant/40">collecting prices…</span>
      </div>
    )
  }
  const w = 100
  const h = 36
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return [x, y] as const
  })
  const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `0,${h} ${line} ${w},${h}`
  const rising = values[values.length - 1] >= values[0]
  const stroke = rising ? '#00e0b3' : '#ff5d73'

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label="Recent spot price trend"
      >
        <defs>
          <linearGradient id="pc-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#pc-spark-fill)" />
        <polyline
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
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
  if (!ms) return 'now'
  const diff = ms - Date.now()
  if (diff <= 0) return 'now'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
