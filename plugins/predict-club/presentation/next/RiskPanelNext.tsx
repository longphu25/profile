import { usePredictClub } from '../usePredictClub'
import { formatCompactDusdc } from '../shared'
import { formatProbabilityLabel } from '../display'
import { PanelShell } from './PanelShell'

/**
 * Risk & Execution (R5) — clear for newcomers, accurate for pros. Surfaces the
 * single Risk Checks readiness block and Your Exposure metrics. Carries NO
 * primary CTA: execution lives only in the ActionRail (R2), so the page never
 * shows a second competing primary action.
 */
export function RiskPanelNext({ className }: { className?: string }) {
  const { pricingSnapshot, riskEvaluation } = usePredictClub()
  const quote = pricingSnapshot.quote
  const fairValue = pricingSnapshot.fairValue
  const quoteUnavailable = quote.status !== 'ok'

  const passed = riskEvaluation.checks.filter((c) => c.passed).length
  const total = riskEvaluation.checks.length
  const ratio = total > 0 ? passed / total : 0
  const failed = riskEvaluation.checks.filter((c) => !c.passed).slice(0, 4)

  const costLabel = `-${formatCompactDusdc(quote.estimatedCost ?? 0)}`
  const probabilityLabel = formatProbabilityLabel(fairValue.probability, {
    degraded: fairValue.degraded,
    reason: fairValue.reason,
  })
  const grossLabel = formatCompactDusdc(quote.grossIfWin)
  const profitLabel =
    quote.potentialProfit !== null
      ? formatCompactDusdc(quote.potentialProfit, { signed: true })
      : '—'
  const riskRewardLabel =
    quote.riskReward && Number.isFinite(quote.riskReward) ? quote.riskReward.toFixed(2) : '—'

  return (
    <PanelShell bordered={false} title="Risk & Execution" icon="gpp_maybe" className={className}>
      <div className="flex flex-col gap-lg">
        {/* Risk Checks */}
        <div>
          <div className="flex items-center justify-between mb-sm">
            <span className="font-label text-label-caps text-on-surface-variant uppercase">
              Risk Checks
            </span>
            <span className="font-data text-data-sm text-primary-fixed-dim tabular-nums">
              {passed}/{total}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-highest mb-sm">
            <div
              className="h-full rounded-full bg-primary-fixed-dim transition-[width]"
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
          <ul className="flex flex-col gap-xs">
            {(failed.length > 0 ? failed : riskEvaluation.checks.slice(0, 4)).map((check) => (
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

        {/* Your Exposure */}
        <div className="bg-surface-container-highest border border-outline-variant p-md rounded-xl flex flex-col gap-sm">
          <div className="flex items-center justify-between">
            <span className="font-label text-label-caps text-on-surface-variant uppercase">
              Your Exposure
            </span>
            {quoteUnavailable && (
              <span className="font-label text-label-caps text-tertiary-fixed-dim uppercase">
                Preview unavailable
              </span>
            )}
          </div>
          <Metric label="Est. cost" value={costLabel} tone="error" />
          <Metric label="Win prob" value={probabilityLabel} />
          <Metric label="Gross if win" value={grossLabel} tone="mint" />
          <Metric label="Profit" value={profitLabel} tone="mint" />
          <Metric label="Risk / reward" value={riskRewardLabel} />
        </div>
      </div>
    </PanelShell>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'mint' | 'error' }) {
  const valueClass =
    tone === 'mint' ? 'text-primary-fixed-dim' : tone === 'error' ? 'text-error' : 'text-on-surface'
  return (
    <div className="flex items-center justify-between">
      <span className="font-data text-data-sm text-on-surface-variant">{label}</span>
      <span className={`font-data text-data-md tabular-nums font-bold ${valueClass}`}>{value}</span>
    </div>
  )
}
