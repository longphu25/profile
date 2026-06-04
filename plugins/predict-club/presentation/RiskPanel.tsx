import { useMemo } from 'react'
import { usePredictClub } from './PredictClubContext'
import { evaluateRiskGate, type RiskGateInput } from '../domain/riskGate'
import { computeConsensus } from '../domain/indicatorConsensus'
import { formatUsd } from './shared'

export function RiskPanel() {
  const { club, context, balances, primaryAction } = usePredictClub()
  const round = club.activeRound

  const riskEval = useMemo(() => {
    const consensus = computeConsensus(round.indicators)
    const input: RiskGateInput = {
      oracleLastUpdate: Date.now() - 30_000, // simulated: 30s ago
      oracleStaleThresholdMs: 60_000,
      expiryMinutes: round.expiryMinutes,
      minSafeExpiryMinutes: 5,
      memberDusdc: balances.dusdc,
      suggestedDusdc: round.suggestedDusdc,
      signalBias: consensus.bias,
      indicators: round.indicators,
    }
    return evaluateRiskGate(input)
  }, [round.indicators, round.expiryMinutes, round.suggestedDusdc, balances.dusdc])

  const blockingReasons = riskEval.checks
    .filter((c) => !c.passed && c.severity === 'blocking')
    .map((c) => c.message ?? c.label)

  return (
    <>
      <div className="p-md border-b border-outline-variant bg-surface-container-high">
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
      <div className="p-md flex flex-col gap-lg flex-1 overflow-y-auto">
        {/* Risk Checks */}
        <div>
          <div className="flex justify-between items-center mb-sm">
            <span className="font-label text-label-caps text-on-surface-variant uppercase">
              Risk Checks
            </span>
            <span
              className={`font-data text-data-sm ${
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
          <div className="flex flex-col gap-xs">
            {riskEval.checks.map((check) => (
              <div
                key={check.id}
                className={`flex items-center gap-sm font-data text-data-sm ${check.passed ? '' : 'opacity-80'}`}
              >
                <span
                  className={`material-symbols-outlined text-[16px] ${
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
                <span className={check.passed ? 'text-on-surface' : 'text-on-surface-variant'}>
                  {check.label}
                </span>
                {!check.passed && check.message && (
                  <span className="ml-auto text-on-surface-variant text-[11px] truncate max-w-[140px]">
                    {check.message}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Blocking reasons */}
        {blockingReasons.length > 0 && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-sm">
            <span className="font-label text-label-caps text-error uppercase block mb-1">
              Blocked
            </span>
            {blockingReasons.map((reason) => (
              <p key={reason} className="font-data text-data-sm text-error/80">
                • {reason}
              </p>
            ))}
          </div>
        )}

        {/* Exposure */}
        <div className="bg-surface-container-highest border border-outline-variant p-md rounded-xl flex flex-col gap-sm">
          <span className="font-label text-label-caps text-on-surface-variant uppercase mb-1">
            Your Exposure
          </span>
          <div className="flex justify-between items-center">
            <span className="font-data text-data-sm text-on-surface-variant">Max Loss</span>
            <span className="font-data text-data-md text-error tabular-nums font-bold">
              -{round.suggestedDusdc} DUSDC
            </span>
          </div>
          <div className="w-full h-px bg-outline-variant" />
          <div className="flex justify-between items-center">
            <span className="font-data text-data-sm text-on-surface-variant">Est. Payout</span>
            <span className="font-data text-data-md text-primary-fixed-dim tabular-nums font-bold">
              +{formatUsd(round.suggestedDusdc * 2.5)} DUSDC
            </span>
          </div>
          <div className="w-full h-px bg-outline-variant" />
          <div className="flex justify-between items-center">
            <span className="font-data text-data-sm text-on-surface-variant">Risk/Reward</span>
            <span className="font-data text-data-md text-primary-fixed-dim tabular-nums">
              1:2.5
            </span>
          </div>
        </div>

        {/* Execute */}
        <div className="mt-auto">
          <button
            className={`w-full px-md py-sm rounded-xl font-headline text-headline-md flex justify-center items-center gap-2 ${
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
            <p className="font-data text-data-sm text-center text-error mt-2">
              Resolve blocking conditions to proceed
            </p>
          )}
          {riskEval.canExecute && !context.isConnected && (
            <p className="font-data text-data-sm text-center text-on-surface-variant mt-2">
              Connect wallet to execute
            </p>
          )}
        </div>
      </div>
    </>
  )
}
