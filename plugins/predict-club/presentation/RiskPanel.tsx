import { useState } from 'react'
import { usePredictClub } from './PredictClubContext'
import type { RiskActionTarget, RiskCheckCategory } from '../domain/riskGate'
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
  const { club, context, primaryAction, oracleSnapshot, riskEvaluation, setModal } =
    usePredictClub()
  const round = club.activeRound
  const [oraclesOpen, setOraclesOpen] = useState(false)

  const activeOracles = oracleSnapshot.oracles.filter((o) => o.status === 'active')
  const riskEval = riskEvaluation
  const groupedChecks: Array<[RiskCheckCategory, string]> = [
    ['funding', 'Tiền & số dư'],
    ['market-data', 'Dữ liệu thị trường'],
    ['trade-safety', 'An toàn giao dịch'],
  ]

  function canRunRiskAction(target?: RiskActionTarget) {
    return target === 'funding' || target === 'oracle'
  }

  function handleRiskAction(target: RiskActionTarget = 'none') {
    if (target === 'funding') setModal('fund-to-join')
    if (target === 'oracle') setOraclesOpen(true)
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
      <div className="p-sm flex flex-col gap-sm flex-1 min-h-0 overflow-hidden">
        <div
          className={`border rounded-lg px-sm py-xs ${
            riskEval.state === 'ready'
              ? 'border-primary-fixed-dim/40 bg-primary-fixed-dim/10'
              : riskEval.state === 'warning'
                ? 'border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10'
                : 'border-error/40 bg-error/10'
          }`}
        >
          <span
            className={`font-label text-label-caps uppercase ${
              riskEval.state === 'ready'
                ? 'text-primary-fixed-dim'
                : riskEval.state === 'warning'
                  ? 'text-tertiary-fixed-dim'
                  : 'text-error'
            }`}
          >
            {riskEval.state === 'ready'
              ? 'Sẵn sàng thực thi'
              : riskEval.state === 'warning'
                ? 'Có cảnh báo cần xem lại'
                : riskEval.state === 'unknown'
                  ? 'Chưa đủ dữ liệu'
                  : 'Đang bị chặn'}
          </span>
          <p className="font-data text-[11px] leading-4 text-on-surface-variant mt-px line-clamp-2">
            {riskEval.state === 'ready'
              ? 'Oracle, expiry, signal và funding đều đạt yêu cầu.'
              : (riskEval.blockingReasons[0]?.message ??
                riskEval.warningReasons[0]?.message ??
                'Review checklist before continuing.')}
          </p>
        </div>

        {/* Oracle Status */}
        <div className="bg-surface-container-highest border border-outline-variant rounded-lg p-sm flex flex-col gap-xs">
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
          <div className="grid grid-cols-2 gap-x-sm gap-y-xs">
            <Metric
              label="Spot"
              value={
                oracleSnapshot.oracleState?.latest_price?.spot
                  ? `$${formatUsd(oracleSnapshot.oracleState.latest_price.spot)}`
                  : '—'
              }
            />
            <Metric
              label="Fwd"
              value={
                oracleSnapshot.oracleState?.latest_price?.forward
                  ? `$${formatUsd(oracleSnapshot.oracleState.latest_price.forward)}`
                  : '—'
              }
            />
            <Metric
              label="Updated"
              muted
              value={
                oracleSnapshot.lastUpdateMs ? formatAge(oracleSnapshot.lastUpdateMs) : 'Pending…'
              }
            />
            <Metric
              label="Status"
              muted
              value={oracleSnapshot.oracleState?.status ?? '—'}
              className="capitalize"
            />
          </div>
          {oracleSnapshot.prices.length > 0 && (
            <div>
              <span className="font-label text-label-caps text-on-surface-variant uppercase block mb-px">
                Price ticks ({oracleSnapshot.prices.length})
              </span>
              <div className="flex items-end gap-px h-5">
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
                <div className="flex flex-col gap-xs mt-xs max-h-28 overflow-y-auto">
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
        <div className="min-h-0 flex flex-col">
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
          <div className="flex flex-col gap-xs min-h-0 max-h-[34vh] overflow-y-auto pr-1">
            {groupedChecks.map(([category, title]) => {
              const checks = riskEval.checks.filter((check) => check.category === category)
              if (checks.length === 0) return null
              return (
                <div key={category} className="flex flex-col gap-xs">
                  <span className="font-label text-label-caps text-on-surface-variant uppercase mt-xs">
                    {title}
                  </span>
                  {checks.map((check) => (
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
                        <div
                          className={check.passed ? 'text-on-surface' : 'text-on-surface-variant'}
                        >
                          {check.label}
                        </div>
                        {!check.passed && check.message && (
                          <p className="text-on-surface-variant text-[10px] mt-px line-clamp-2">
                            {check.message}
                          </p>
                        )}
                        {!check.passed && check.actionHint && (
                          <p className="text-on-surface-variant text-[10px] mt-px line-clamp-2">
                            {check.actionHint}
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
              )
            })}
          </div>
        </div>

        {/* Blocking reasons */}
        {riskEval.blockingReasons.length > 0 && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-sm">
            <span className="font-label text-label-caps text-error uppercase block mb-1">
              Blocked
            </span>
            {riskEval.blockingReasons.map((reason) => (
              <p key={reason.id} className="font-data text-data-sm text-error/80">
                • {reason.message ?? reason.label}
              </p>
            ))}
          </div>
        )}

        {/* Exposure */}
        <div className="bg-surface-container-highest border border-outline-variant p-sm rounded-lg flex flex-col gap-xs">
          <span className="font-label text-label-caps text-on-surface-variant uppercase mb-px">
            Your Exposure
          </span>
          <div className="flex justify-between items-center">
            <span className="font-data text-[11px] text-on-surface-variant">Max Loss</span>
            <span className="font-data text-data-sm text-error tabular-nums font-bold">
              -{round.suggestedDusdc} DUSDC
            </span>
          </div>
          <div className="w-full h-px bg-outline-variant" />
          <div className="flex justify-between items-center">
            <span className="font-data text-[11px] text-on-surface-variant">Est. Payout</span>
            <span className="font-data text-data-sm text-primary-fixed-dim tabular-nums font-bold">
              +{formatUsd(round.suggestedDusdc * 2.5)} DUSDC
            </span>
          </div>
          <div className="w-full h-px bg-outline-variant" />
          <div className="flex justify-between items-center">
            <span className="font-data text-[11px] text-on-surface-variant">Risk/Reward</span>
            <span className="font-data text-data-sm text-primary-fixed-dim tabular-nums">
              1:2.5
            </span>
          </div>
        </div>

        {/* Execute */}
        <div className="mt-auto shrink-0">
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

function Metric({
  label,
  value,
  muted,
  className = '',
}: {
  label: string
  value: string
  muted?: boolean
  className?: string
}) {
  return (
    <div className="min-w-0">
      <span className="font-label text-label-caps text-on-surface-variant uppercase block">
        {label}
      </span>
      <span
        className={`font-data text-data-sm tabular-nums truncate block ${
          muted ? 'text-on-surface-variant' : 'text-on-surface'
        } ${className}`}
      >
        {value}
      </span>
    </div>
  )
}
