import { useMemo, useState } from 'react'
import { usePredictClub } from '../usePredictClub'
import { selectOracle } from '../../infrastructure/deepbookOracleService'
import { formatCompactDusdc, formatUsd } from '../shared'
import { formatProbabilityLabel } from '../display'

/**
 * THROWAWAY prototype — Variant C: "Single Scroll Feed".
 *
 * Linear, read top-to-bottom: a compact oracle dropdown, then inline UP/DOWN
 * cards, then an accordion that expands full order economics in place. No
 * carousel, no sheet — just one column you scroll. All data is real
 * (usePredictClub + selectOracle); the CTA defers to primaryAction so the real
 * modal flow still owns execution. Delete when a direction is chosen.
 */

type Call = 'UP' | 'DOWN' | null

export function VariantC() {
  const { oracleSnapshot, pricingSnapshot, primaryAction, riskEvaluation, context } =
    usePredictClub()
  const oracles = useMemo(
    () => oracleSnapshot.oracles.filter((o) => o.status === 'active'),
    [oracleSnapshot.oracles],
  )
  const [call, setCall] = useState<Call>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const spot = oracleSnapshot.oracleState?.latest_price?.spot ?? 0
  const forward = oracleSnapshot.oracleState?.latest_price?.forward ?? 0
  const quote = pricingSnapshot.quote
  const fair = pricingSnapshot.fairValue
  const selectedId = oracleSnapshot.selectedOracleId

  const blocked = primaryAction.label === 'Execute Trade' && !riskEvaluation.canExecute

  return (
    <div className="mx-auto flex h-full w-full max-w-[28rem] flex-col gap-3 overflow-y-auto px-4 py-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))]">
      {/* 1. Oracle picker (compact dropdown) */}
      <section>
        <span className="font-label text-label-caps uppercase tracking-widest text-on-surface-variant/70">
          Market
        </span>
        {oracles.length === 0 ? (
          <p className="mt-1 font-data text-data-sm text-on-surface-variant/60">
            No active oracles right now.
          </p>
        ) : (
          <div className="relative mt-1">
            <select
              value={selectedId ?? ''}
              onChange={(e) => selectOracle(e.target.value)}
              className="h-12 w-full appearance-none rounded-2xl border border-outline-variant bg-surface-container px-4 pr-10 font-data text-data-md text-on-surface"
            >
              {oracles.map((o) => (
                <option key={o.oracle_id} value={o.oracle_id}>
                  {o.underlying_asset} · settles {formatExpiry(o.expiry)}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              expand_more
            </span>
          </div>
        )}
      </section>

      {/* 2. Spot snapshot */}
      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
        <div className="flex items-baseline gap-2">
          <span className="font-headline text-[2.5rem] font-black leading-none text-on-surface tabular-nums">
            ${formatUsd(spot)}
          </span>
          <span className="ml-auto font-label text-label-caps uppercase text-primary-fixed-dim">
            {formatProbabilityLabel(fair.probability, {
              degraded: fair.degraded,
              reason: fair.reason,
            })}
          </span>
        </div>
        <div className="mt-1 font-data text-data-sm text-on-surface-variant">
          Forward ${formatUsd(forward)}
        </div>
      </section>

      {/* 3. Inline UP / DOWN cards */}
      <section className="grid grid-cols-2 gap-2">
        <CallCard dir="UP" active={call === 'UP'} onClick={() => setCall('UP')} spot={spot} />
        <CallCard dir="DOWN" active={call === 'DOWN'} onClick={() => setCall('DOWN')} spot={spot} />
      </section>

      {/* 4. Accordion detail in place */}
      <section className="rounded-2xl border border-outline-variant bg-surface-container">
        <button
          type="button"
          onClick={() => setDetailOpen((o) => !o)}
          aria-expanded={detailOpen}
          className="flex h-12 w-full items-center justify-between px-4 font-label text-label-caps uppercase text-on-surface-variant"
        >
          Order detail
          <span
            className="material-symbols-outlined transition-transform"
            style={{ transform: detailOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            expand_more
          </span>
        </button>
        {detailOpen && (
          <div className="flex flex-col gap-1 border-t border-outline-variant/50 px-4 py-3">
            {context.isConnected ? (
              <>
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
              </>
            ) : (
              <p className="py-1 font-data text-data-sm text-on-surface-variant/60">
                Connect your wallet to see cost and potential profit.
              </p>
            )}
          </div>
        )}
      </section>

      {/* 5. Place CTA → real flow */}
      <div className="mt-auto pt-2">
        {!context.isConnected ? (
          <button
            type="button"
            onClick={primaryAction.action}
            className="h-14 w-full rounded-2xl bg-primary-fixed-dim font-headline text-headline-md text-on-primary-fixed"
          >
            Connect Wallet
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={primaryAction.action}
              disabled={call === null || blocked}
              className={[
                'h-14 w-full rounded-2xl font-headline text-headline-md transition-colors',
                call === null || blocked
                  ? 'bg-surface-variant text-on-surface-variant'
                  : call === 'UP'
                    ? 'bg-primary-fixed-dim text-on-primary-fixed glow-mint'
                    : 'bg-error text-on-error',
              ].join(' ')}
            >
              {call === null
                ? 'Pick UP or DOWN'
                : `${primaryAction.label}${primaryAction.label === 'Execute Trade' ? ` · ${call}` : ''}`}
            </button>
            {blocked && riskEvaluation.blockingReasons[0]?.message && (
              <p className="mt-1.5 text-center font-data text-[11px] text-error">
                {riskEvaluation.blockingReasons[0].message}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CallCard({
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
        'flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 transition-all',
        active
          ? up
            ? 'border-primary-fixed-dim bg-primary-fixed-dim/15 text-primary-fixed-dim'
            : 'border-error bg-error/15 text-error'
          : 'border-outline-variant bg-surface-container text-on-surface-variant',
      ].join(' ')}
    >
      <span className="material-symbols-outlined text-[30px]">
        {up ? 'trending_up' : 'trending_down'}
      </span>
      <span className="font-headline text-headline-md font-black">{up ? 'UP' : 'DOWN'}</span>
      <span className="font-data text-[10px] uppercase opacity-70">
        {up ? 'above' : 'below'} ${formatUsd(spot)}
      </span>
    </button>
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
    <div className="flex items-center justify-between border-b border-outline-variant/40 py-1.5 last:border-0">
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
