import { usePredictClub } from '../usePredictClub'
import { formatCompactDusdc } from '../shared'
import { formatProbabilityLabel } from '../display'

/**
 * Exposure & risk rail (C4): risk readiness + position economics, docked under
 * the action rail. Carries NO primary CTA - execution lives only in the
 * ActionDock (decision 6 of plan 22), so the cockpit never shows a second
 * competing primary action.
 *
 * `Your Exposure` is wallet-gated: no cost/profit numbers render until connected,
 * so demo values are never shown as real. Em-dash is banned, so the empty marker
 * is a plain hyphen.
 */
export function ExposureRail({ className = '' }: { className?: string }) {
  const { pricingSnapshot, riskEvaluation, context } = usePredictClub()
  const quote = pricingSnapshot.quote
  const fairValue = pricingSnapshot.fairValue
  const quoteUnavailable = quote.status !== 'ok'

  const passed = riskEvaluation.checks.filter((c) => c.passed).length
  const total = riskEvaluation.checks.length
  const ratio = total > 0 ? passed / total : 0
  const failed = riskEvaluation.checks.filter((c) => !c.passed).slice(0, 4)
  const shown = failed.length > 0 ? failed : riskEvaluation.checks.slice(0, 4)

  const costLabel = `-${formatCompactDusdc(quote.estimatedCost ?? 0)}`
  const probabilityLabel = formatProbabilityLabel(fairValue.probability, {
    degraded: fairValue.degraded,
    reason: fairValue.reason,
  })
  const grossLabel = formatCompactDusdc(quote.grossIfWin)
  const profitLabel =
    quote.potentialProfit !== null
      ? formatCompactDusdc(quote.potentialProfit, { signed: true })
      : '-'
  const riskRewardLabel =
    quote.riskReward && Number.isFinite(quote.riskReward) ? quote.riskReward.toFixed(2) : '-'

  return (
    <section
      data-pc-exposure
      aria-label="Risk and exposure"
      className={`flex min-h-0 flex-col gap-md overflow-y-auto bg-surface-container p-md ${className}`}
    >
      {/* Risk Checks */}
      <div>
        <div className="mb-sm flex items-center justify-between">
          <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
            Risk Checks
          </span>
          <span className="font-data text-data-sm tabular-nums text-primary-fixed-dim">
            {passed}/{total}
          </span>
        </div>
        <div className="mb-sm h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
          <div
            className="h-full rounded-full bg-primary-fixed-dim transition-[width]"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
        <ul className="flex flex-col gap-xs">
          {shown.map((check) => (
            <li key={check.id} className="flex items-center gap-sm font-data text-data-sm">
              <span
                className={[
                  'material-symbols-outlined text-[16px]',
                  check.passed
                    ? 'text-primary-fixed-dim'
                    : check.severity === 'blocking'
                      ? 'text-error'
                      : 'text-tertiary-fixed-dim',
                ].join(' ')}
                aria-hidden="true"
              >
                {check.passed ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              <span className={check.passed ? 'text-on-surface' : 'text-on-surface-variant'}>
                {check.message ?? check.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Your Exposure (wallet-gated) */}
      <div className="flex flex-col gap-sm rounded-xl border border-outline-variant bg-surface-container-highest p-md">
        <div className="flex items-center justify-between">
          <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
            Your Exposure
          </span>
          {context.isConnected && quoteUnavailable && (
            <span className="font-label text-label-caps uppercase tracking-wider text-tertiary-fixed-dim">
              Preview unavailable
            </span>
          )}
        </div>
        {context.isConnected ? (
          <>
            <Metric label="Est. cost" value={costLabel} tone="error" />
            <Metric label="Win prob" value={probabilityLabel} />
            <Metric label="Gross if win" value={grossLabel} tone="mint" />
            <Metric label="Profit" value={profitLabel} tone="mint" />
            <Metric label="Risk / reward" value={riskRewardLabel} />
          </>
        ) : (
          <p className="py-xs font-data text-data-sm text-on-surface-variant/60">
            Connect your wallet to see your position cost and potential profit.
          </p>
        )}
      </div>
    </section>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'mint' | 'error' }) {
  const valueClass =
    tone === 'mint' ? 'text-primary-fixed-dim' : tone === 'error' ? 'text-error' : 'text-on-surface'
  return (
    <div className="flex items-center justify-between">
      <span className="font-data text-data-sm text-on-surface-variant">{label}</span>
      <span className={`font-data text-data-md font-bold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  )
}
