import { useMemo, useRef, useState } from 'react'
import { usePredictClub } from '../usePredictClub'
import { selectOracle } from '../../infrastructure/deepbookOracleService'
import { formatCompactDusdc, formatUsd } from '../shared'
import { formatProbabilityLabel } from '../display'

/**
 * THROWAWAY prototype — Variant A: "Swipe Deck".
 *
 * Mobile-first, casual-user oriented. A horizontal slide-card carousel picks the
 * oracle (one card at a time), two big UP/DOWN buttons set the call, and tapping
 * the card flips it to reveal full order economics. All data is real
 * (usePredictClub + selectOracle); the final CTA defers to primaryAction so the
 * real modal flow still owns execution. Delete when a direction is chosen.
 */

type Call = 'UP' | 'DOWN' | null

export function VariantA() {
  const { oracleSnapshot, pricingSnapshot, primaryAction, riskEvaluation, context } =
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
  const [flipped, setFlipped] = useState(false)
  const [call, setCall] = useState<Call>(null)
  const touchX = useRef<number | null>(null)

  const active = oracles[idx]
  const spot = oracleSnapshot.oracleState?.latest_price?.spot ?? 0
  const forward = oracleSnapshot.oracleState?.latest_price?.forward ?? 0
  const quote = pricingSnapshot.quote
  const fair = pricingSnapshot.fairValue

  function go(delta: number) {
    if (oracles.length === 0) return
    const next = (idx + delta + oracles.length) % oracles.length
    setIdx(next)
    setFlipped(false)
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
      {/* Oracle position dots */}
      <div className="flex items-center justify-center gap-1.5 py-2" aria-hidden="true">
        {oracles.map((o, i) => (
          <span
            key={o.oracle_id}
            className={[
              'h-1.5 rounded-full transition-all',
              i === idx ? 'w-5 bg-primary-fixed-dim' : 'w-1.5 bg-outline-variant',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Slide card */}
      <div
        className="relative flex-1 select-none px-1"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="group relative h-full w-full overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest text-left shadow-xl transition-colors"
          aria-label={flipped ? 'Show summary' : 'Show full detail'}
        >
          {/* arrows for non-touch */}
          <span
            onClick={(e) => {
              e.stopPropagation()
              go(-1)
            }}
            className="material-symbols-outlined absolute left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface-container/80 text-on-surface-variant lg:flex"
          >
            chevron_left
          </span>
          <span
            onClick={(e) => {
              e.stopPropagation()
              go(1)
            }}
            className="material-symbols-outlined absolute right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface-container/80 text-on-surface-variant lg:flex"
          >
            chevron_right
          </span>

          {!flipped ? (
            <div className="flex h-full flex-col justify-between p-6">
              <div>
                <span className="font-label text-label-caps uppercase tracking-widest text-on-surface-variant/70">
                  {active?.underlying_asset ?? 'Oracle'} · settles {formatExpiry(active?.expiry)}
                </span>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-headline text-[2.75rem] font-black leading-none text-on-surface tabular-nums">
                    ${formatUsd(spot)}
                  </span>
                </div>
                <div className="mt-1 font-data text-data-sm text-on-surface-variant">
                  Forward ${formatUsd(forward)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-label text-label-caps uppercase text-primary-fixed-dim">
                  {formatProbabilityLabel(fair.probability, {
                    degraded: fair.degraded,
                    reason: fair.reason,
                  })}
                </span>
                <span className="ml-auto flex items-center gap-1 font-data text-[11px] uppercase text-on-surface-variant/60">
                  Tap for detail
                  <span className="material-symbols-outlined text-[14px]">flip</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col gap-2 overflow-auto p-6">
              <span className="font-label text-label-caps uppercase tracking-widest text-on-surface-variant/70">
                Order detail
              </span>
              <DetailRow label="Asset" value={active?.underlying_asset ?? '—'} />
              <DetailRow label="Spot" value={`$${formatUsd(spot)}`} />
              <DetailRow label="Forward" value={`$${formatUsd(forward)}`} />
              <DetailRow
                label="Est. cost"
                value={`-${formatCompactDusdc(quote.estimatedCost ?? 0)}`}
                tone="error"
              />
              <DetailRow
                label="Gross if win"
                value={formatCompactDusdc(quote.grossIfWin)}
                tone="mint"
              />
              <DetailRow
                label="Profit"
                value={
                  quote.potentialProfit !== null
                    ? formatCompactDusdc(quote.potentialProfit, { signed: true })
                    : '—'
                }
                tone="mint"
              />
              <DetailRow
                label="Risk / reward"
                value={
                  quote.riskReward && Number.isFinite(quote.riskReward)
                    ? quote.riskReward.toFixed(2)
                    : '—'
                }
              />
              <span className="mt-1 font-data text-[11px] text-on-surface-variant/50">
                Tap again to go back
              </span>
            </div>
          )}
        </button>
      </div>

      {/* UP / DOWN call */}
      <div className="grid grid-cols-2 gap-2 px-1 pt-3">
        <CallButton dir="UP" active={call === 'UP'} onClick={() => setCall('UP')} spot={spot} />
        <CallButton
          dir="DOWN"
          active={call === 'DOWN'}
          onClick={() => setCall('DOWN')}
          spot={spot}
        />
      </div>

      {/* Place CTA → real flow */}
      <PlaceBar
        call={call}
        primaryLabel={primaryAction.label}
        onPlace={primaryAction.action}
        connected={context.isConnected}
        blocked={primaryAction.label === 'Execute Trade' && !riskEvaluation.canExecute}
        blockingReason={riskEvaluation.blockingReasons[0]?.message}
      />
    </Screen>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col px-4 pb-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  )
}

function CallButton({
  dir,
  active,
  onClick,
  spot,
}: {
  dir: 'UP' | 'DOWN'
  active: boolean
  onClick: () => void
  spot: number
}) {
  const up = dir === 'UP'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 transition-all',
        active
          ? up
            ? 'border-primary-fixed-dim bg-primary-fixed-dim/15 text-primary-fixed-dim'
            : 'border-error bg-error/15 text-error'
          : 'border-outline-variant bg-surface-container text-on-surface-variant',
      ].join(' ')}
    >
      <span className="material-symbols-outlined text-[28px]">
        {up ? 'trending_up' : 'trending_down'}
      </span>
      <span className="font-headline text-headline-md font-black">{up ? 'UP' : 'DOWN'}</span>
      <span className="font-data text-[10px] uppercase opacity-70">
        {up ? 'above' : 'below'} ${formatUsd(spot)}
      </span>
    </button>
  )
}

function PlaceBar({
  call,
  primaryLabel,
  onPlace,
  connected,
  blocked,
  blockingReason,
}: {
  call: Call
  primaryLabel: string
  onPlace: () => void
  connected: boolean
  blocked: boolean
  blockingReason?: string
}) {
  if (!connected) {
    return (
      <button
        type="button"
        onClick={onPlace}
        className="mt-3 h-14 w-full rounded-2xl bg-primary-fixed-dim font-headline text-headline-md text-on-primary-fixed"
      >
        Connect Wallet
      </button>
    )
  }
  const disabled = call === null || blocked
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onPlace}
        disabled={disabled}
        className={[
          'flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-headline text-headline-md transition-colors',
          disabled
            ? 'bg-surface-variant text-on-surface-variant'
            : call === 'UP'
              ? 'bg-primary-fixed-dim text-on-primary-fixed glow-mint'
              : 'bg-error text-on-error',
        ].join(' ')}
      >
        {call === null
          ? 'Pick UP or DOWN'
          : `${primaryLabel}${primaryLabel === 'Execute Trade' ? ` · ${call}` : ''}`}
      </button>
      {blocked && blockingReason && (
        <p className="mt-1.5 text-center font-data text-[11px] text-error">{blockingReason}</p>
      )}
    </div>
  )
}

function DetailRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'mint' | 'error'
}) {
  const c =
    tone === 'mint' ? 'text-primary-fixed-dim' : tone === 'error' ? 'text-error' : 'text-on-surface'
  return (
    <div className="flex items-center justify-between border-b border-outline-variant/40 py-1.5">
      <span className="font-data text-data-sm text-on-surface-variant">{label}</span>
      <span className={`font-data text-data-md font-bold tabular-nums ${c}`}>{value}</span>
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
