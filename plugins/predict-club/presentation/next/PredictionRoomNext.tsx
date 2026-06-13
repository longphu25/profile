import { useMemo, useState } from 'react'
import { usePredictClub } from '../usePredictClub'
import { computeConsensus } from '../../domain/indicatorConsensus'
import { labelize } from '../shared'
import { OrderFlowChart } from '../OrderFlowChart'
import { PanelShell } from './PanelShell'

/**
 * Prediction Room (R4) — the center column, scannable top-to-bottom as
 * context → evidence → chart. Carries NO `Phase: {round.status}` raw text;
 * lifecycle context lives only in RoundLifecycleStrip (R3).
 */
export function PredictionRoomNext({ className }: { className?: string }) {
  const { club, oracleSnapshot, riskEvaluation } = usePredictClub()
  const round = club.activeRound
  const [evidenceOpen, setEvidenceOpen] = useState(false)

  const consensus = useMemo(() => computeConsensus(round.indicators), [round.indicators])
  const topReasons = consensus.reasons.slice(0, 3)
  const firstRiskNote =
    riskEvaluation.blockingReasons[0]?.message ?? riskEvaluation.warningReasons[0]?.message

  const biasClass =
    consensus.bias === 'bullish'
      ? 'bg-primary-fixed-dim/20 text-primary-fixed-dim'
      : consensus.bias === 'bearish' || consensus.bias === 'no-trade'
        ? 'bg-error/20 text-error'
        : 'bg-surface-container text-on-surface-variant border border-outline-variant'

  return (
    <PanelShell
      bordered={false}
      title="Prediction Room"
      icon="analytics"
      className={className}
      actions={
        <span className={`px-sm py-1 rounded font-label text-label-caps uppercase ${biasClass}`}>
          {labelize(consensus.bias)} · {consensus.confidence}
        </span>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-sm">
        {/* Leader thesis */}
        {round.thesis && (
          <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
            <div className="absolute left-0 top-0 h-full w-1 bg-secondary-fixed" />
            <span className="ml-3 block font-label text-label-caps uppercase tracking-wider text-secondary-fixed">
              Leader Thesis
            </span>
            <p className="ml-3 mt-1 font-body text-body-base leading-relaxed text-on-surface">
              {round.thesis}
            </p>
          </div>
        )}

        {/* Indicator bento */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-outline-variant bg-outline-variant md:grid-cols-4">
          {round.indicators.slice(0, 4).map((ind) => (
            <div
              key={ind.id}
              className="flex flex-col items-center justify-center gap-1 bg-surface-container p-sm"
            >
              <span className="font-label text-label-caps uppercase text-on-surface-variant">
                {ind.name}
              </span>
              <span
                className={`font-data text-data-md font-bold ${
                  ind.state === 'bullish'
                    ? 'text-primary-fixed-dim'
                    : ind.state === 'bearish' || ind.state === 'blocked'
                      ? 'text-error'
                      : 'text-on-surface-variant'
                }`}
              >
                {ind.value}
              </span>
            </div>
          ))}
        </div>

        {/* Signal evidence (collapsible) */}
        <div className="flex items-center gap-md rounded-xl border border-outline-variant bg-surface-container-highest p-sm">
          <button
            type="button"
            onClick={() => setEvidenceOpen((open) => !open)}
            aria-expanded={evidenceOpen}
            className="flex items-center gap-1 font-label text-label-caps uppercase text-on-surface-variant transition-colors hover:text-on-surface"
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
          <div className="flex flex-col gap-sm">
            {evidenceOpen && topReasons.length > 0 && (
              <div className="grid grid-cols-1 gap-xs rounded-xl border border-outline-variant bg-surface-container-highest p-sm md:grid-cols-3">
                {topReasons.map((reason) => (
                  <EvidenceReason key={reason} reason={reason} />
                ))}
              </div>
            )}
            {riskEvaluation.state !== 'ready' && (
              <div
                className={`rounded-xl border p-sm ${
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
                <p className="mt-px font-data text-[11px] leading-4 text-on-surface-variant">
                  {firstRiskNote ?? 'Review risk checks before continuing.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        <div className="flex min-h-[200px] flex-1 flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          <OrderFlowChart prices={oracleSnapshot.prices} />
        </div>
      </div>
    </PanelShell>
  )
}

function EvidenceReason({ reason }: { reason: string }) {
  const [name, detail = ''] = reason.split(': ')
  return (
    <div className="min-w-0 rounded-lg border border-outline-variant/60 bg-surface-container px-xs py-xs">
      <span className="block truncate font-label text-label-caps uppercase text-on-surface-variant">
        {name}
      </span>
      <span className="block truncate font-data text-[11px] leading-4 text-on-surface">
        {detail}
      </span>
    </div>
  )
}
