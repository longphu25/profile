import { useMemo, useState } from 'react'
import { usePredictClub } from './PredictClubContext'
import { evaluateRiskGate, type RiskGateInput } from '../domain/riskGate'
import { computeConsensus } from '../domain/indicatorConsensus'
import { formatUsd } from './shared'

function formatAge(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}

function formatExpiry(ms: number): string {
  const diff = ms - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function RiskPanel() {
  const { club, context, balances, primaryAction, oracleSnapshot } = usePredictClub()
  const round = club.activeRound
  const [oraclesOpen, setOraclesOpen] = useState(false)

  const activeOracles = oracleSnapshot.oracles.filter((o) => o.status === 'active')

  const riskEval = useMemo(() => {
    const consensus = computeConsensus(round.indicators)
    const input: RiskGateInput = {
      oracleLastUpdate: oracleSnapshot.lastUpdateMs || Date.now() - 30_000,
      oracleStaleThresholdMs: 60_000,
      expiryMinutes: round.expiryMinutes,
      minSafeExpiryMinutes: 5,
      memberDusdc: balances.dusdc,
      suggestedDusdc: round.suggestedDusdc,
      signalBias: consensus.bias,
      indicators: round.indicators,
    }
    return evaluateRiskGate(input)
  }, [
    round.indicators,
    round.expiryMinutes,
    round.suggestedDusdc,
    balances.dusdc,
    oracleSnapshot.lastUpdateMs,
  ])

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
        {/* Oracle Status */}
        <div className="bg-surface-container-highest border border-outline-variant rounded-xl p-md flex flex-col gap-sm">
          <div className="flex items-center justify-between">
            <span className="font-label text-label-caps text-on-surface-variant uppercase">
              DeepBook Oracle
            </span>
            <span
              className={`flex items-center gap-1 font-label text-label-caps uppercase ${
                oracleSnapshot.isHealthy ? 'text-primary-fixed-dim' : 'text-error'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  oracleSnapshot.isHealthy ? 'bg-primary-fixed-dim animate-pulse' : 'bg-error'
                }`}
              />
              {oracleSnapshot.isHealthy ? 'Live' : 'Stale'}
            </span>
          </div>
          <div className="flex flex-col gap-xs">
            {/* Row 1: Spot & Forward */}
            <div className="flex items-center gap-md">
              <div className="flex-1 min-w-0">
                <span className="font-label text-label-caps text-on-surface-variant uppercase block">
                  Spot
                </span>
                <span className="font-data text-data-sm tabular-nums text-on-surface truncate block">
                  {oracleSnapshot.oracleState?.latest_price?.spot
                    ? `$${formatUsd(oracleSnapshot.oracleState.latest_price.spot)}`
                    : '—'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-label text-label-caps text-on-surface-variant uppercase block">
                  Fwd
                </span>
                <span className="font-data text-data-sm tabular-nums text-on-surface truncate block">
                  {oracleSnapshot.oracleState?.latest_price?.forward
                    ? `$${formatUsd(oracleSnapshot.oracleState.latest_price.forward)}`
                    : '—'}
                </span>
              </div>
            </div>
            {/* Row 2: Updated & Status */}
            <div className="flex items-center gap-md">
              <div className="flex-1 min-w-0">
                <span className="font-label text-label-caps text-on-surface-variant uppercase block">
                  Updated
                </span>
                <span className="font-data text-data-sm text-on-surface-variant truncate block">
                  {oracleSnapshot.lastUpdateMs
                    ? formatAge(oracleSnapshot.lastUpdateMs)
                    : 'Pending…'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-label text-label-caps text-on-surface-variant uppercase block">
                  Status
                </span>
                <span className="font-data text-data-sm text-on-surface-variant capitalize truncate block">
                  {oracleSnapshot.oracleState?.status ?? '—'}
                </span>
              </div>
            </div>
          </div>
          {oracleSnapshot.prices.length > 0 && (
            <div className="mt-xs">
              <span className="font-label text-label-caps text-on-surface-variant uppercase block mb-1">
                Price ticks ({oracleSnapshot.prices.length})
              </span>
              <div className="flex items-end gap-px h-8">
                {oracleSnapshot.prices.slice(-24).map((p, i) => {
                  const all = oracleSnapshot.prices.slice(-24).map((x) => x.spot)
                  const min = Math.min(...all)
                  const max = Math.max(...all)
                  const range = max - min || 1
                  const pct = ((p.spot - min) / range) * 100
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-primary-fixed-dim/40 rounded-sm"
                      style={{ height: `${Math.max(10, pct)}%` }}
                    />
                  )
                })}
              </div>
            </div>
          )}
          {activeOracles.length > 0 && (
            <div className="border-t border-outline-variant pt-xs">
              <button
                type="button"
                onClick={() => setOraclesOpen((v) => !v)}
                className="flex items-center justify-between w-full cursor-pointer group"
              >
                <span className="font-label text-label-caps text-on-surface-variant uppercase">
                  Active Oracles ({activeOracles.length})
                </span>
                <span
                  className="material-symbols-outlined text-[14px] text-on-surface-variant transition-transform group-hover:text-on-surface"
                  style={{ transform: oraclesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>
              {oraclesOpen && (
                <div className="flex flex-col gap-xs mt-xs max-h-40 overflow-y-auto">
                  {activeOracles.map((o) => (
                    <div
                      key={o.oracle_id}
                      className={`flex flex-col gap-px p-xs rounded-lg border ${
                        o.oracle_id === oracleSnapshot.selectedOracleId
                          ? 'border-primary-fixed-dim/50 bg-primary-fixed-dim/5'
                          : 'border-outline-variant bg-surface-container'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-sm">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-fixed-dim animate-pulse shrink-0" />
                          <span className="font-data text-data-sm text-on-surface font-bold truncate">
                            {o.underlying_asset}
                          </span>
                          {o.oracle_id === oracleSnapshot.selectedOracleId && (
                            <span className="font-label text-label-caps text-primary-fixed-dim uppercase shrink-0">
                              Selected
                            </span>
                          )}
                        </div>
                        <span className="font-label text-label-caps text-on-surface-variant uppercase shrink-0">
                          {formatExpiry(o.expiry)}
                        </span>
                      </div>
                      <div className="flex items-center gap-sm">
                        <span className="font-label text-label-caps text-on-surface-variant uppercase">
                          ID
                        </span>
                        <span className="font-data text-[10px] text-on-surface-variant truncate">
                          {o.oracle_id.slice(0, 10)}…{o.oracle_id.slice(-6)}
                        </span>
                      </div>
                      {o.settlement_price !== null && (
                        <div className="flex items-center gap-sm">
                          <span className="font-label text-label-caps text-on-surface-variant uppercase">
                            Settle
                          </span>
                          <span className="font-data text-data-sm tabular-nums text-tertiary-fixed-dim">
                            ${formatUsd(o.settlement_price)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

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
