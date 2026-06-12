import { useState } from 'react'
import { usePredictClub } from './usePredictClub'
import type { RiskActionTarget, RiskCheckCategory } from '../domain/riskGate'
import { formatCompactDusdc, formatUsd } from './shared'
import { formatProbabilityLabel, shortenSuiAddress } from './display'

export function RiskPanel() {
  const { club, context, primaryAction, pricingSnapshot, riskEvaluation, setModal } =
    usePredictClub()
  const round = club.activeRound
  const [exposureOpen, setExposureOpen] = useState(false)
  const [backingOpen, setBackingOpen] = useState(false)
  const fairValuePreview = pricingSnapshot.fairValue
  const contractQuote = pricingSnapshot.quote
  const maxLossDusdc = contractQuote.estimatedCost ?? round.suggestedDusdc
  const quoteUnavailable = contractQuote.status !== 'ok'
  const hasIndicativeQuote =
    contractQuote.grossIfWin !== null ||
    contractQuote.potentialProfit !== null ||
    contractQuote.riskReward !== null
  const isFlooredProbability = fairValuePreview.reason === 'Probability floored for display'
  const probabilityLabel = formatProbabilityLabel(fairValuePreview.probability, {
    degraded: fairValuePreview.degraded,
    reason: fairValuePreview.reason,
  })
  const profitLabel =
    contractQuote.potentialProfit !== null
      ? formatCompactDusdc(contractQuote.potentialProfit, { signed: true })
      : '—'
  const grossIfWinLabel = formatCompactDusdc(contractQuote.grossIfWin)
  const costLabel = `-${formatCompactDusdc(maxLossDusdc)}`
  const riskRewardLabel =
    contractQuote.riskReward && Number.isFinite(contractQuote.riskReward)
      ? contractQuote.riskReward.toFixed(2)
      : '—'
  const quoteReason = compactQuoteReason(
    contractQuote.reason ?? 'Waiting for oracle, manager, or contract quote data.',
  )
  const exposureStatusLabel = quoteUnavailable
    ? hasIndicativeQuote
      ? 'SVI estimate'
      : 'Preview unavailable'
    : 'Contract quote'
  const riskEval = riskEvaluation
  const passedChecks = riskEval.checks.filter((check) => check.passed).length
  const failedChecks = riskEval.checks.filter((check) => !check.passed)
  const visibleChecks =
    failedChecks.length > 0 ? failedChecks.slice(0, 4) : riskEval.checks.slice(0, 4)
  const hiddenCheckCount = Math.max(0, riskEval.checks.length - visibleChecks.length)
  const quoteStateLabel = quoteUnavailable
    ? hasIndicativeQuote
      ? 'Preview'
      : 'Unavailable'
    : 'Ready'
  const executionStateLabel = !context.isConnected
    ? 'Requires Wallet'
    : riskEval.state === 'ready'
      ? 'Ready'
      : riskEval.state === 'warning'
        ? 'Requires Review'
        : 'Blocked'
  const managerSummary = pricingSnapshot.manager
    ? `${pricingSnapshot.manager.positions.length} open`
    : 'Unavailable'
  const vaultSummary = pricingSnapshot.vault
    ? `${formatCompactDusdc(pricingSnapshot.vault.availableLiquidity)} DUSDC`
    : 'Unavailable'
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
              {passedChecks}/{riskEval.checks.length}
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
                width: `${Math.round((passedChecks / riskEval.checks.length) * 100)}%`,
              }}
            />
          </div>
          <div className="flex flex-col gap-xs min-h-0 pr-1">
            {visibleChecks.map((check) => (
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
            {hiddenCheckCount > 0 && (
              <span className="font-data text-[10px] leading-4 text-on-surface-variant px-xs">
                +{hiddenCheckCount} lower-priority checks hidden
              </span>
            )}
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

          <div className="grid grid-cols-2 gap-[1px] bg-outline-variant border border-outline-variant rounded overflow-hidden sm:grid-cols-5">
            <CompactMetric label="Cost" tone="loss" value={costLabel} />
            <CompactMetric label="Win" tone="gain" value={probabilityLabel} />
            <CompactMetric label="Gross" tone="gain" value={grossIfWinLabel} />
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
                    {quoteReason}
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
                        {quoteReason}
                      </p>
                    </div>
                  )}

                  <span className="font-data text-[11px] text-on-surface-variant">
                    Contract Price
                  </span>
                  <span className="font-data text-data-md text-on-surface tabular-nums font-bold text-right min-w-0 break-words">
                    {contractQuote.contractPrice
                      ? formatCompactDusdc(contractQuote.contractPrice)
                      : '—'}
                    <span className="text-[10px] leading-none ml-1 text-on-surface-variant">
                      DUSDC
                    </span>
                  </span>

                  <span className="font-data text-[11px] text-on-surface-variant">
                    Gross If Win
                  </span>
                  <span className="font-data text-data-md text-primary-fixed-dim tabular-nums font-bold text-right min-w-0 break-words">
                    {grossIfWinLabel}
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

        <div className="bg-surface-container-highest border border-outline-variant rounded-lg p-md flex flex-col gap-sm min-w-0">
          <button
            type="button"
            className="flex items-start justify-between gap-sm text-left w-full cursor-pointer"
            onClick={() => setBackingOpen((open) => !open)}
            aria-expanded={backingOpen}
          >
            <div className="min-w-0">
              <span className="font-label text-label-caps text-on-surface-variant uppercase block">
                Account Backing
              </span>
              <span className="font-data text-[10px] leading-4 text-on-surface-variant block truncate">
                Portfolio {managerSummary} · Vault {vaultSummary}
              </span>
            </div>
            <span
              className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0 transition-transform"
              style={{ transform: backingOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              expand_more
            </span>
          </button>

          <div className="grid grid-cols-2 gap-xs">
            <CompactMetric label="Portfolio" tone="gain" value={managerSummary} />
            <CompactMetric label="Vault" tone="gain" value={vaultSummary} />
          </div>

          {backingOpen && (
            <div className="flex flex-col gap-sm border-t border-outline-variant pt-sm">
              {pricingSnapshot.manager ? (
                <>
                  <div className="grid grid-cols-3 gap-xs">
                    <CompactMetric
                      label="Binary"
                      tone="gain"
                      value={String(
                        pricingSnapshot.manager.positions.filter(
                          (position) => position.kind === 'binary',
                        ).length,
                      )}
                    />
                    <CompactMetric
                      label="Range"
                      tone="gain"
                      value={String(
                        pricingSnapshot.manager.positions.filter(
                          (position) => position.kind === 'range',
                        ).length,
                      )}
                    />
                    <CompactMetric
                      label="Balance"
                      tone="gain"
                      value={formatCompactDusdc(pricingSnapshot.manager.quoteBalance)}
                    />
                  </div>

                  {pricingSnapshot.manager.positions.length ? (
                    <div className="flex flex-col gap-xs">
                      {pricingSnapshot.manager.positions.slice(0, 3).map((position) => (
                        <div
                          key={position.id}
                          className="rounded-md border border-outline-variant bg-surface-container px-sm py-xs flex items-center justify-between gap-sm"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-xs min-w-0">
                              <span className="font-label text-[9px] leading-3 text-on-surface-variant uppercase border border-outline-variant rounded px-[4px] py-px shrink-0">
                                {position.kind}
                              </span>
                              <span className="font-data text-[11px] text-on-surface truncate">
                                {shortenSuiAddress(position.oracleId)}
                              </span>
                            </div>
                            <p className="font-data text-[10px] leading-4 text-on-surface-variant truncate">
                              {position.side
                                ? `${position.side} · ${formatUsd(position.strike ?? 0)} strike`
                                : `${formatUsd(position.lowerStrike ?? 0)} - ${formatUsd(position.upperStrike ?? 0)} range`}
                            </p>
                          </div>
                          <span className="font-data text-data-sm text-primary-fixed-dim tabular-nums shrink-0">
                            {formatCompactDusdc(position.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-md border border-outline-variant bg-surface-container px-sm py-xs">
                  <span className="font-data text-[11px] leading-4 text-on-surface-variant block">
                    {pricingSnapshot.managerReason ?? 'Manager-owned positions unavailable'}
                  </span>
                </div>
              )}

              {pricingSnapshot.vault ? (
                <div className="grid grid-cols-2 gap-xs">
                  <CompactMetric
                    label="Max payout"
                    tone="gain"
                    value={formatCompactDusdc(pricingSnapshot.vault.totalMaxPayout)}
                  />
                  <CompactMetric
                    label="Withdrawal"
                    tone="gain"
                    value={formatCompactDusdc(pricingSnapshot.vault.availableWithdrawal)}
                  />
                  <CompactMetric
                    label="LP share"
                    tone="gain"
                    value={
                      Number.isFinite(pricingSnapshot.vault.walletLpShare)
                        ? `${(pricingSnapshot.vault.walletLpShare * 100).toFixed(2)}%`
                        : '—'
                    }
                  />
                  <CompactMetric
                    label="Liquidity"
                    tone="gain"
                    value={formatCompactDusdc(pricingSnapshot.vault.availableLiquidity)}
                  />
                </div>
              ) : (
                <div className="rounded-md border border-outline-variant bg-surface-container px-sm py-xs">
                  <span className="font-data text-[11px] leading-4 text-on-surface-variant block">
                    {pricingSnapshot.vaultReason ?? 'Vault liquidity unavailable'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Execute */}
        <div className="shrink-0 flex flex-col gap-xs">
          <div className="grid grid-cols-3 gap-xs">
            <StatusPill
              label="Wallet"
              value={context.isConnected ? 'Ready' : 'Required'}
              tone={context.isConnected ? 'ready' : 'blocked'}
            />
            <StatusPill
              label="Risk"
              value={executionStateLabel}
              tone={
                riskEval.state === 'ready'
                  ? 'ready'
                  : riskEval.state === 'warning'
                    ? 'review'
                    : 'blocked'
              }
            />
            <StatusPill
              label="Quote"
              value={quoteStateLabel}
              tone={quoteUnavailable ? (hasIndicativeQuote ? 'review' : 'blocked') : 'ready'}
            />
          </div>
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
              {riskEval.blockingReasons[0]?.message ??
                riskEval.warningReasons[0]?.message ??
                'Resolve blocking conditions to proceed'}
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

function compactQuoteReason(reason: string): string {
  if (reason.includes('outside the contract pricing bounds')) {
    return 'Strike is outside contract pricing bounds. Try a nearer strike or active oracle.'
  }
  if (reason.includes('devInspect')) {
    return 'Contract quote failed. Showing SVI estimate when available.'
  }
  if (reason.length > 120) return `${reason.slice(0, 117)}...`
  return reason
}

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'ready' | 'review' | 'blocked'
}) {
  return (
    <div
      className={`rounded-md border px-xs py-[3px] min-w-0 ${
        tone === 'ready'
          ? 'border-primary-fixed-dim/30 bg-primary-fixed-dim/5'
          : tone === 'review'
            ? 'border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/5'
            : 'border-error/30 bg-error/5'
      }`}
    >
      <span className="font-label text-[9px] leading-3 text-on-surface-variant uppercase block truncate">
        {label}
      </span>
      <span
        className={`font-data text-[10px] leading-4 block truncate ${
          tone === 'ready'
            ? 'text-primary-fixed-dim'
            : tone === 'review'
              ? 'text-tertiary-fixed-dim'
              : 'text-error'
        }`}
        title={value}
      >
        {value}
      </span>
    </div>
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
