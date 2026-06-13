import { useEffect, useState } from 'react'
import { usePredictClub } from '../usePredictClub'
import { PanelShell } from './PanelShell'
import {
  PHASE_HINT,
  PHASE_LABEL,
  PHASE_ORDER,
  formatTimer,
  mapStatusToPhase,
  secondsToSettlement,
  settlementProgress,
} from '../../domain/roundPhase'

/**
 * Round Lifecycle Strip (R3, subsumes Story 19 Phase 9).
 *
 * A 5-node horizontal stepper plus a phase banner. The countdown is truthful:
 * a live `MM:SS` timer is shown ONLY while the round is `executed` and the
 * oracle expiry is in the future. User-driven phases show their label + hint
 * with no fabricated timer. `cancelled` replaces the stepper with a red banner.
 */
export function RoundLifecycleStrip({ className }: { className?: string }) {
  const { club, oracleSnapshot } = usePredictClub()
  const round = club.activeRound
  const status = round.status
  const mapping = mapStatusToPhase(status)
  const oracleExpiryMs = oracleSnapshot.oracleState?.expiry ?? null

  // Only tick while the round is live — no wasted re-renders in other phases.
  const isLive = status === 'executed'
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!isLive) return undefined
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [isLive])

  if (mapping.cancelled) {
    return (
      <PanelShell bordered={false} title="Round Lifecycle" icon="timeline" className={className}>
        <div
          className="flex items-center gap-sm rounded-lg border border-error/40 bg-error-container/20 px-md py-sm"
          role="alert"
        >
          <span className="material-symbols-outlined text-error">cancel</span>
          <span className="font-data text-data-md text-error">Round cancelled</span>
        </div>
      </PanelShell>
    )
  }

  const seconds = secondsToSettlement({ status, oracleExpiryMs, nowMs })
  const progress = settlementProgress({
    confirmedAtMs: round.confirmedAt,
    oracleExpiryMs,
    nowMs,
  })

  return (
    <PanelShell bordered={false} title="Round Lifecycle" icon="timeline" className={className}>
      <div className="flex flex-col gap-sm">
        {/* 5-node stepper */}
        <ol className="flex items-center" aria-label="Round lifecycle">
          {PHASE_ORDER.map((phase, i) => {
            const stepNum = i + 1
            const done = mapping.stepIndex > stepNum
            const current = mapping.stepIndex === stepNum
            return (
              <li key={phase} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={[
                      'flex h-7 w-7 items-center justify-center rounded-full border font-data text-data-sm transition-colors',
                      done
                        ? 'border-primary-fixed-dim bg-primary-fixed-dim text-on-primary-fixed'
                        : current
                          ? 'border-primary-fixed-dim text-primary-fixed-dim glow-mint'
                          : 'border-outline-variant bg-surface-container text-on-surface-variant/50',
                    ].join(' ')}
                    aria-current={current ? 'step' : undefined}
                  >
                    {done ? (
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    ) : (
                      stepNum
                    )}
                  </span>
                  <span
                    className={[
                      'font-label text-label-caps uppercase tracking-wider',
                      current || done ? 'text-primary-fixed-dim' : 'text-on-surface-variant/50',
                    ].join(' ')}
                  >
                    {PHASE_LABEL[phase]}
                  </span>
                </div>
                {i < PHASE_ORDER.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={[
                      'mx-1 h-px flex-1 transition-colors',
                      done ? 'bg-primary-fixed-dim' : 'bg-outline-variant',
                    ].join(' ')}
                  />
                )}
              </li>
            )
          })}
        </ol>

        {/* Phase banner */}
        <div className="flex items-center justify-between gap-sm">
          <span className="font-body text-body-sm text-on-surface-variant">
            {PHASE_HINT[mapping.phase]}
          </span>
          {isLive && seconds !== null ? (
            <span className="font-data text-data-lg tabular-nums text-primary-fixed-dim">
              Settles in {formatTimer(seconds)}
            </span>
          ) : status === 'settled' ? (
            <span className="font-data text-data-sm uppercase tracking-wider text-tertiary-fixed-dim">
              Awaiting claim
            </span>
          ) : status === 'claimed' ? (
            <span className="font-data text-data-sm uppercase tracking-wider text-primary-fixed-dim">
              Claimed ✓
            </span>
          ) : null}
        </div>

        {/* Settlement progress (live only, when anchors known) */}
        {isLive && progress !== null && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div
              className="h-full rounded-full bg-primary-fixed-dim transition-[width] duration-1000 ease-linear"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}
      </div>
    </PanelShell>
  )
}
