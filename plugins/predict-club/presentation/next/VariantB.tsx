import { useMemo, useState } from 'react'
import { usePredictClub } from '../usePredictClub'
import { selectOracle } from '../../infrastructure/deepbookOracleService'
import { formatCompactDusdc, formatUsd } from '../shared'
import { formatProbabilityLabel } from '../display'

/**
 * THROWAWAY prototype — Variant B: "Bottom-Sheet Trader".
 *
 * Context (oracle chips + price + signal feed) scrolls in the upper region; the
 * action lives in a pinned bottom sheet that can be dragged/expanded. Collapsed,
 * the sheet shows just UP/DOWN + Place. Expanded, it reveals full order economics
 * (cost / gross / profit / risk) before committing. All data is real
 * (usePredictClub + selectOracle); the final CTA defers to primaryAction so the
 * real modal flow still owns execution. Delete when a direction is chosen.
 */

type Call = 'UP' | 'DOWN' | null

export function VariantB() {
  const { oracleSnapshot, pricingSnapshot, primaryAction, riskEvaluation, context, club } =
    usePredictClub()
  const round = club.activeRound
  const oracles = useMemo(
    () => oracleSnapshot.oracles.filter((o) => o.status === 'active'),
    [oracleSnapshot.oracles],
  )
  const [call, setCall] = useState<Call>(null)
  const [expanded, setExpanded] = useState(false)

  const spot = oracleSnapshot.oracleState?.latest_price?.spot ?? 0
  const forward = oracleSnapshot.oracleState?.latest_price?.forward ?? 0
  const quote = pricingSnapshot.quote
  const fair = pricingSnapshot.fairValue
  const blocked = primaryAction.label === 'Execute Trade' && !riskEvaluation.canExecute

  return (
    <div className="relative mx-auto flex h-full w-full max-w-[28rem] flex-col overflow-hidden">
      {/* Scrollable context region */}
      <div className="flex-1 overflow-y-auto px-4 pb-[14rem] pt-3">
        {/* Oracle chip rail */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
          {oracles.length === 0 ? (
            <span className="font-data text-data-sm text-on-surface-variant/60">
              No active oracles right now.
            </span>
          ) : (
            oracles.map((o) => {
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
            })
          )}
        </div>

        {/* Price headline */}
        <div className="mt-3 rounded-3xl border border-outline-variant bg-surface-container-lowest p-5">
          <span className="font-label text-label-caps uppercase tracking-widest text-on-surface-variant/70">
            {round.market} spot
          </span>
          <div className="mt-2 font-headline text-[2.5rem] font-black leading-none tabular-nums text-on-surface">
            ${formatUsd(spot)}
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

        {/* Leader thesis */}
        {round.thesis && (
          <div className="mt-3 rounded-2xl border border-outline-variant bg-surface-container p-4">
            <span className="font-label text-label-caps uppercase tracking-widest text-secondary-fixed">
              Leader thesis
            </span>
            <p className="mt-1 font-body text-body-base leading-relaxed text-on-surface">
              {round.thesis}
            </p>
          </div>
        )}

        {/* Indicator feed */}
        <div className="mt-3 flex flex-col gap-2">
          {round.indicators.slice(0, 5).map((ind) => (
            <div
              key={ind.id}
              className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5"
            >
              <span className="font-label text-label-caps uppercase text-on-surface-variant">
                {ind.name}
              </span>
              <span
                className={[
                  'font-data text-data-md font-bold',
                  ind.state === 'bullish'
                    ? 'text-primary-fixed-dim'
                    : ind.state === 'bearish' || ind.state === 'blocked'
                      ? 'text-error'
                      : 'text-on-surface-variant',
                ].join(' ')}
              >
                {ind.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pinned bottom sheet */}
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-outline-variant bg-surface-container-high shadow-2xl [padding-bottom:max(1rem,env(safe-area-inset-bottom))]">
        {/* Grab handle / expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse order detail' : 'Expand order detail'}
          className="flex w-full flex-col items-center pt-2"
        >
          <span className="h-1.5 w-10 rounded-full bg-outline-variant" />
          <span className="mt-1 flex items-center gap-1 font-data text-[11px] uppercase text-on-surface-variant/60">
            {expanded ? 'Hide detail' : 'Order detail'}
            <span
              className="material-symbols-outlined text-[16px] transition-transform"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
            >
              expand_less
            </span>
          </span>
        </button>

        {/* Expanded economics */}
        {expanded && (
          <div className="max-h-[40vh] overflow-y-auto px-4 pt-2">
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
          </div>
        )}

        {/* UP / DOWN + place */}
        <div className="px-4 pt-3">
          <div className="grid grid-cols-2 gap-2">
            {(['UP', 'DOWN'] as const).map((dir) => {
              const sel = call === dir
              const up = dir === 'UP'
              return (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setCall(dir)}
                  aria-pressed={sel}
                  className={[
                    'flex h-14 items-center justify-center gap-2 rounded-2xl border-2 font-headline text-headline-md font-black transition-all',
                    sel
                      ? up
                        ? 'border-primary-fixed-dim bg-primary-fixed-dim/15 text-primary-fixed-dim'
                        : 'border-error bg-error/15 text-error'
                      : 'border-outline-variant bg-surface-container text-on-surface-variant',
                  ].join(' ')}
                >
                  <span className="material-symbols-outlined text-[22px]">
                    {up ? 'trending_up' : 'trending_down'}
                  </span>
                  {dir}
                </button>
              )
            })}
          </div>

          {!context.isConnected ? (
            <button
              type="button"
              onClick={primaryAction.action}
              className="mt-2 h-14 w-full rounded-2xl bg-primary-fixed-dim font-headline text-headline-md text-on-primary-fixed"
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
                  'mt-2 flex h-14 w-full items-center justify-center rounded-2xl font-headline text-headline-md transition-colors',
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
