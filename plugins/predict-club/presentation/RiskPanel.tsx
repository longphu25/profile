import { useState } from 'react'
import { usePredictClub } from './PredictClubContext'
import type { RiskActionTarget, RiskCheckCategory } from '../domain/riskGate'
import { formatUsd } from './shared'

export function RiskPanel() {
  const { club, context, primaryAction, pricingSnapshot, riskEvaluation, setModal } =
    usePredictClub()
  const round = club.activeRound
  const [exposureOpen, setExposureOpen] = useState(false)
  const fairValuePreview = pricingSnapshot.fairValue
  const contractQuote = pricingSnapshot.quote
  const maxLossDusdc = contractQuote.estimatedCost ?? round.suggestedDusdc
  const quoteUnavailable = contractQuote.status !== 'ok'
  const hasIndicativeQuote =
    contractQuote.grossIfWin !== null ||
    contractQuote.potentialProfit !== null ||
    contractQuote.riskReward !== null
  const probabilityUnavailable = fairValuePreview.degraded || !fairValuePreview.probability
  const isFlooredProbability = fairValuePreview.reason === 'Probability floored for display'
  const probabilityLabel = isFlooredProbability
    ? '<0.1%'
    : probabilityUnavailable
      ? '—'
      : `${((fairValuePreview.probability ?? 0) * 100).toFixed(1)}%`
  const profitLabel =
    contractQuote.potentialProfit !== null ? `+${formatUsd(contractQuote.potentialProfit)}` : '—'
  const riskRewardLabel = contractQuote.riskReward ? contractQuote.riskReward.toFixed(2) : '—'
  const exposureStatusLabel = quoteUnavailable
    ? hasIndicativeQuote
      ? 'SVI estimate'
      : 'Preview unavailable'
    : 'Contract quote'
  const riskEval = riskEvaluation
  const categoryLabels: Record<RiskCheckCategory, string> = {
    funding: 'Funding',
    'market-data': 'Market',
    'trade-safety': 'Safety',
  }

  function canRunRiskAction(target?: RiskActionTarget) {
    return target === 'funding'
  }

  function handleRiskAction(target: RiskActionTarget = 'none') {
    if (target === 'funding') setModal('fund-to-join')
  }

  return (
    <>
      <div className="px-md py-sm border-b border-outline-variant bg-surface-container-high">
        <h2 className="font-headline text-headline-md text-primary flex items-center gap-2">
          <span
            className={`material-symbols-outlined ${
              riskEval.state === 'ready'
                ? 'text-primary-fixed-dim'
                : riskEval.state === 'warning'
                  ? 'text-tertiary-fixed-dim'
                  : 'text-error'
            }`}
          >
            {riskEval.state === 'ready' ? 'verified_user' : 'gpp_maybe'}
          </span>{' '}
          Risk &amp; Execution
        </h2>
      </div>
      <div className="p-sm flex flex-col gap-sm flex-1 min-h-0 overflow-y-auto overscroll-contain pr-2">
        {/* Risk Checks */}
        <div className="min-h-0 flex flex-col">
          <div className="flex justify-between items-center mb-sm">
            <div className="min-w-0">
              <span className="font-label text-label-caps text-on-surface-variant uppercase block">
                Risk Checks
              </span>
              <span className="font-data text-[10px] leading-4 text-on-surface-variant block truncate">
                {riskEval.state === 'ready'
                  ? 'All required checks passed'
                  : (riskEval.blockingReasons[0]?.message ??
                    riskEval.warningReasons[0]?.message ??
                    'Review checklist before continuing')}
              </span>
            </div>
            <span
              className={`font-data text-data-sm shrink-0 ${
                riskEval.state === 'ready'
                  ? 'text-primary-fixed-dim'
                  : riskEval.state === 'warning'
                    ? 'text-tertiary-fixed-dim'
                    : 'text-error'
              }`}
            >
              {riskEval.checks.filter((c) => c.passed).length}/{riskEval.checks.length}
            </span>
          </div>
          <div className="w-full h-1 bg-surface-container-highest rounded-full mb-sm overflow-hidden">
            <div
              className={`h-full rounded-full ${
                riskEval.state === 'ready'
                  ? 'bg-primary-fixed-dim'
                  : riskEval.state === 'warning'
                    ? 'bg-tertiary-fixed-dim'
                    : 'bg-error'
              }`}
              style={{
                width: `${Math.round((riskEval.checks.filter((c) => c.passed).length / riskEval.checks.length) * 100)}%`,
              }}
            />
          </div>
          <div className="flex flex-col gap-xs min-h-0 max-h-[28vh] overflow-y-auto pr-1">
            {riskEval.checks.map((check) => (
              <div
                key={check.id}
                className={`flex items-start gap-xs font-data text-[11px] leading-4 rounded-lg p-xs ${
                  check.passed ? 'bg-transparent' : 'bg-surface-container-highest'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[16px] mt-px ${
                    check.passed
                      ? 'text-primary-fixed-dim'
                      : check.severity === 'blocking'
                        ? 'text-error'
                        : 'text-tertiary-fixed-dim'
                  }`}
                >
                  {check.passed
                    ? 'check_circle'
                    : check.severity === 'blocking'
                      ? 'cancel'
                      : 'warning'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-xs min-w-0">
                    <span
                      className={
                        check.passed
                          ? 'text-on-surface truncate'
                          : 'text-on-surface-variant truncate'
                      }
                    >
                      {check.label}
                    </span>
                    <span className="font-label text-[9px] leading-3 text-on-surface-variant uppercase border border-outline-variant rounded px-[4px] py-px shrink-0">
                      {categoryLabels[check.category]}
                    </span>
                  </div>
                  {!check.passed && check.message && (
                    <p className="text-on-surface-variant text-[10px] mt-px line-clamp-2">
                      {check.message}
                    </p>
                  )}
                </div>
                {!check.passed && canRunRiskAction(check.actionTarget) && (
                  <button
                    type="button"
                    className="font-label text-label-caps text-primary-fixed-dim uppercase border border-primary-fixed-dim/40 rounded px-xs py-[2px]"
                    onClick={() => handleRiskAction(check.actionTarget)}
                  >
                    {check.actionLabel ?? 'Review'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Exposure */}
        <div className="bg-surface-container-highest border border-primary-fixed-dim/30 p-md rounded-lg flex flex-col gap-sm shadow-[0_0_24px_rgba(0,224,179,0.08)] shrink-0 min-w-0">
          <button
            type="button"
            className="flex items-start justify-between gap-sm text-left w-full cursor-pointer"
            onClick={() => setExposureOpen((open) => !open)}
            aria-expanded={exposureOpen}
          >
            <div className="min-w-0">
              <span className="font-label text-label-caps text-primary-fixed-dim uppercase block">
                Your Exposure
              </span>
              <span className="font-data text-[10px] leading-4 text-on-surface-variant block truncate">
                {exposureStatusLabel}
              </span>
            </div>
            <span
              className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0 transition-transform"
              style={{ transform: exposureOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              expand_more
            </span>
          </button>

          <div className="grid grid-cols-3 gap-[1px] bg-outline-variant border border-outline-variant rounded overflow-hidden">
            <CompactMetric label="Cost" tone="loss" value={`-${formatUsd(maxLossDusdc)}`} />
            <CompactMetric label="Profit" tone="gain" value={profitLabel} />
            <CompactMetric label="R/R" tone="gain" value={riskRewardLabel} />
          </div>

          {exposureOpen && (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] gap-x-sm gap-y-xs items-end min-w-0 border-t border-outline-variant pt-sm">
              {quoteUnavailable && !hasIndicativeQuote ? (
                <div className="col-span-2 rounded-md border border-outline-variant bg-surface-container px-sm py-xs">
                  <div className="flex items-center justify-between gap-sm">
                    <span className="font-label text-label-caps text-on-surface-variant uppercase">
                      Contract quote unavailable
                    </span>
                    <span className="material-symbols-outlined text-[16px] text-tertiary-fixed-dim">
                      info
                    </span>
                  </div>
                  <p className="font-data text-[11px] leading-4 text-on-surface-variant mt-1">
                    {contractQuote.reason ?? 'Waiting for oracle, manager, or contract quote data.'}
                  </p>
                </div>
              ) : (
                <>
                  {quoteUnavailable && (
                    <div className="col-span-2 rounded-md border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/5 px-sm py-xs">
                      <div className="flex items-center justify-between gap-sm">
                        <span className="font-label text-label-caps text-tertiary-fixed-dim uppercase">
                          SVI-only estimate
                        </span>
                        <span className="material-symbols-outlined text-[16px] text-tertiary-fixed-dim">
                          info
                        </span>
                      </div>
                      <p className="font-data text-[11px] leading-4 text-on-surface-variant mt-1">
                        {contractQuote.reason ?? 'Contract quote unavailable; showing SVI preview.'}
                      </p>
                    </div>
                  )}

                  <span className="font-data text-[11px] text-on-surface-variant">
                    Contract Price
                  </span>
                  <span className="font-data text-data-md text-on-surface tabular-nums font-bold text-right min-w-0 break-words">
                    {contractQuote.contractPrice ? formatUsd(contractQuote.contractPrice) : '—'}
                    <span className="text-[10px] leading-none ml-1 text-on-surface-variant">
                      DUSDC
                    </span>
                  </span>

                  <span className="font-data text-[11px] text-on-surface-variant">
                    Gross If Win
                  </span>
                  <span className="font-data text-data-md text-primary-fixed-dim tabular-nums font-bold text-right min-w-0 break-words">
                    {formatUsd(contractQuote.grossIfWin ?? 0)}
                    <span className="text-[10px] leading-none ml-1 text-on-surface-variant">
                      DUSDC
                    </span>
                  </span>

                  <span className="font-data text-[11px] text-on-surface-variant">
                    {isFlooredProbability ? 'Capped Win Probability' : 'Win Probability'}
                  </span>
                  <span className="font-data text-data-md text-primary-fixed-dim tabular-nums font-bold text-right min-w-0 break-words">
                    {probabilityLabel}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-xs">
          <div className="bg-surface-container-highest border border-outline-variant rounded-lg p-sm min-w-0">
            <span className="font-label text-label-caps text-on-surface-variant uppercase block">
              Portfolio
            </span>
            <span className="font-data text-data-md text-on-surface tabular-nums block mt-1">
              {pricingSnapshot.manager
                ? `${pricingSnapshot.manager.positions.length} open`
                : context.isConnected
                  ? 'No manager'
                  : 'Connect wallet'}
            </span>
            <span className="font-data text-[10px] leading-4 text-on-surface-variant block truncate">
              {pricingSnapshot.manager
                ? `${formatUsd(pricingSnapshot.manager.quoteBalance)} DUSDC manager balance`
                : 'Manager-owned positions'}
            </span>
          </div>
          <div className="bg-surface-container-highest border border-outline-variant rounded-lg p-sm min-w-0">
            <span className="font-label text-label-caps text-on-surface-variant uppercase block">
              Vault
            </span>
            <span className="font-data text-data-md text-on-surface tabular-nums block mt-1">
              {pricingSnapshot.vault
                ? `${formatUsd(pricingSnapshot.vault.availableLiquidity)} DUSDC`
                : 'Unavailable'}
            </span>
            <span className="font-data text-[10px] leading-4 text-on-surface-variant block truncate">
              Available liquidity
            </span>
          </div>
        </div>

        {/* Execute */}
        <div className="shrink-0">
          <button
            className={`w-full px-md py-sm rounded-lg font-headline text-headline-md flex justify-center items-center gap-2 ${
              riskEval.canExecute && context.isConnected
                ? 'bg-primary-fixed-dim text-on-primary-fixed cursor-pointer hover:opacity-90 transition-opacity'
                : 'bg-surface-variant text-on-surface-variant border border-outline opacity-50 cursor-not-allowed'
            }`}
            type="button"
            disabled={!riskEval.canExecute || !context.isConnected}
            onClick={primaryAction.action}
          >
            {!riskEval.canExecute && <span className="material-symbols-outlined">lock</span>}
            {primaryAction.label}
          </button>
          {!riskEval.canExecute && (
            <p className="font-data text-[11px] text-center text-error mt-1">
              Resolve blocking conditions to proceed
            </p>
          )}
          {riskEval.canExecute && !context.isConnected && (
            <p className="font-data text-[11px] text-center text-on-surface-variant mt-1">
              Connect wallet to execute
            </p>
          )}
        </div>
      </div>
    </>
  )
}

function CompactMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'gain' | 'loss'
}) {
  return (
    <div className="bg-surface-container p-xs min-w-0">
      <span className="font-label text-[9px] leading-3 text-on-surface-variant uppercase block">
        {label}
      </span>
      <span
        className={`font-data text-[12px] leading-4 tabular-nums font-bold block truncate ${
          tone === 'gain'
            ? 'text-primary-fixed-dim'
            : tone === 'loss'
              ? 'text-error'
              : 'text-on-surface'
        }`}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}
