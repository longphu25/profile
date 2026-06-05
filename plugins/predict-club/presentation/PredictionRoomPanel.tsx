import { useMemo, useState } from 'react'
import { usePredictClub } from './PredictClubContext'
import { computeConsensus } from '../domain/indicatorConsensus'
import { labelize } from './shared'
import { OrderFlowChart } from './OrderFlowChart'
export function PredictionRoomPanel() {
  const { club, oracleSnapshot, riskEvaluation } = usePredictClub()
  const round = club.activeRound
  const [evidenceOpen, setEvidenceOpen] = useState(false)

  const consensus = useMemo(() => computeConsensus(round.indicators), [round.indicators])
  const topReasons = consensus.reasons.slice(0, 6)
  const firstRiskNote =
    riskEvaluation.blockingReasons[0]?.message ?? riskEvaluation.warningReasons[0]?.message

  return (
    <>
      <div className="p-md border-b border-outline-variant bg-surface-container-high flex justify-between items-center">
        <div className="flex items-center gap-sm min-w-0">
          <h2 className="font-headline text-headline-md text-primary flex items-center gap-2">
            <span className="material-symbols-outlined">analytics</span> Prediction Room
          </h2>
          <div
            className={`px-sm py-1 rounded font-label text-label-caps uppercase shrink-0 ${
              consensus.bias === 'bullish'
                ? 'bg-primary-fixed-dim/20 text-primary-fixed-dim'
                : consensus.bias === 'bearish'
                  ? 'bg-error/20 text-error'
                  : consensus.bias === 'no-trade'
                    ? 'bg-error/20 text-error'
                    : 'bg-surface-container text-on-surface-variant border border-outline-variant'
            }`}
          >
            {labelize(consensus.bias)} · {consensus.confidence}
          </div>
        </div>
        <div className="flex items-center gap-sm">
          <div className="px-sm py-1 bg-surface-container border border-outline-variant rounded font-label text-label-caps text-on-surface-variant">
            Phase: {round.status.toUpperCase()}
          </div>
          <div className="px-sm py-1 bg-surface-container border border-outline-variant rounded font-label text-label-caps text-tertiary-fixed-dim">
            {round.id}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-md flex flex-col gap-sm">
        {/* Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-outline-variant rounded-xl overflow-hidden border border-outline-variant">
          {round.indicators.slice(0, 4).map((ind) => (
            <div
              key={ind.id}
              className="bg-surface-container p-sm flex flex-col justify-center items-center gap-1 hover:bg-surface-bright transition-colors cursor-pointer"
            >
              <span className="font-label text-label-caps text-on-surface-variant uppercase">
                {ind.name}
              </span>
              <span
                className={`font-data text-data-md font-bold ${
                  ind.state === 'bullish'
                    ? 'text-primary-fixed-dim'
                    : ind.state === 'bearish'
                      ? 'text-error'
                      : 'text-on-surface-variant'
                }`}
              >
                {ind.value}
              </span>
            </div>
          ))}
        </div>

        {/* Consensus Summary */}
        <div className="flex items-center gap-md p-sm bg-surface-container-highest rounded-xl border border-outline-variant">
          <button
            type="button"
            onClick={() => setEvidenceOpen((open) => !open)}
            className="flex items-center gap-1 font-label text-label-caps text-on-surface-variant uppercase hover:text-on-surface transition-colors"
          >
            <span
              className="material-symbols-outlined text-[16px] transition-transform"
              style={{ transform: evidenceOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              expand_more
            </span>
            Signal Evidence
          </button>
          <div className="ml-auto flex items-center gap-sm font-data text-data-sm">
            <span className="text-primary-fixed-dim">{consensus.bullishCount}↑</span>
            <span className="text-error">{consensus.bearishCount}↓</span>
            <span className="text-on-surface-variant">{consensus.neutralCount}—</span>
            {consensus.blockedCount > 0 && (
              <span className="text-error">{consensus.blockedCount}✕</span>
            )}
          </div>
        </div>

        {(evidenceOpen || riskEvaluation.state !== 'ready') && (
          <div className="grid grid-cols-1 gap-sm">
            {evidenceOpen && (
              <div className="bg-surface-container-highest border border-outline-variant rounded-xl p-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-xs">
                  {topReasons.slice(0, 3).map((reason) => (
                    <EvidenceReason key={reason} reason={reason} />
                  ))}
                </div>
              </div>
            )}
            {riskEvaluation.state !== 'ready' && (
              <div
                className={`border rounded-xl p-sm ${
                  riskEvaluation.state === 'warning'
                    ? 'border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10'
                    : 'border-error/40 bg-error/10'
                }`}
              >
                <span
                  className={`font-label text-label-caps uppercase ${
                    riskEvaluation.state === 'warning' ? 'text-tertiary-fixed-dim' : 'text-error'
                  }`}
                >
                  Risk: {labelize(riskEvaluation.state)}
                </span>
                <p className="font-data text-[11px] leading-4 text-on-surface-variant mt-px">
                  {firstRiskNote ?? 'Review risk checks before continuing.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        <div className="flex-1 min-h-[200px] border border-outline-variant bg-surface-container-lowest rounded-xl overflow-hidden flex flex-col">
          <OrderFlowChart prices={oracleSnapshot.prices} />
        </div>
      </div>
    </>
  )
}

function EvidenceReason({ reason }: { reason: string }) {
  const [name, detail = ''] = reason.split(': ')
  return (
    <div className="min-w-0 bg-surface-container rounded-lg border border-outline-variant/60 px-xs py-xs">
      <span className="font-label text-label-caps text-on-surface-variant uppercase block truncate">
        {name}
      </span>
      <span className="font-data text-[11px] leading-4 text-on-surface truncate block">
        {detail}
      </span>
    </div>
  )
}
