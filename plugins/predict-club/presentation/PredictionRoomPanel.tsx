import { useMemo } from 'react'
import { usePredictClub } from './PredictClubContext'
import { computeConsensus } from '../domain/indicatorConsensus'
import { labelize } from './shared'
import { OrderFlowChart } from './OrderFlowChart'
export function PredictionRoomPanel() {
  const { club, oracleSnapshot } = usePredictClub()
  const round = club.activeRound

  const consensus = useMemo(() => computeConsensus(round.indicators), [round.indicators])

  return (
    <>
      <div className="p-md border-b border-outline-variant bg-surface-container-high flex justify-between items-center">
        <h2 className="font-headline text-headline-md text-primary flex items-center gap-2">
          <span className="material-symbols-outlined">analytics</span> Prediction Room
        </h2>
        <div className="flex items-center gap-sm">
          <div className="px-sm py-1 bg-surface-container border border-outline-variant rounded font-label text-label-caps text-on-surface-variant">
            Phase: {round.status.toUpperCase()}
          </div>
          <div className="px-sm py-1 bg-surface-container border border-outline-variant rounded font-label text-label-caps text-tertiary-fixed-dim">
            {round.id}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-md flex flex-col gap-md">
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
          <div
            className={`px-sm py-1 rounded font-label text-label-caps uppercase ${
              consensus.bias === 'bullish'
                ? 'bg-primary-fixed-dim/20 text-primary-fixed-dim'
                : consensus.bias === 'bearish'
                  ? 'bg-error/20 text-error'
                  : consensus.bias === 'no-trade'
                    ? 'bg-error/20 text-error'
                    : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {labelize(consensus.bias)}
          </div>
          <span className="font-data text-data-sm text-on-surface-variant">
            Confidence: <span className="text-on-surface">{consensus.confidence}</span>
          </span>
          <div className="ml-auto flex items-center gap-sm font-data text-data-sm">
            <span className="text-primary-fixed-dim">{consensus.bullishCount}↑</span>
            <span className="text-error">{consensus.bearishCount}↓</span>
            <span className="text-on-surface-variant">{consensus.neutralCount}—</span>
            {consensus.blockedCount > 0 && (
              <span className="text-error">{consensus.blockedCount}✕</span>
            )}
          </div>
        </div>

        {/* Chart */}
        <div
          style={{ height: '320px' }}
          className="border border-outline-variant bg-surface-container-lowest rounded-xl overflow-hidden flex flex-col shrink-0"
        >
          <OrderFlowChart prices={oracleSnapshot.prices} />
        </div>
      </div>
    </>
  )
}
