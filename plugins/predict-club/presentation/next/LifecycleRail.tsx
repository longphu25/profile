import { useEffect, useState } from 'react'
import { usePredictClub } from '../usePredictClub'
import {
  PHASE_LABEL,
  PHASE_ORDER,
  formatTimer,
  mapStatusToPhase,
  secondsToSettlement,
} from '../../domain/roundPhase'

/**
 * Lifecycle rail (C3): a thin single-row stepper band above the chart.
 *
 * Compact form of the lifecycle strip - it lives in a thin cockpit band, not a
 * padded panel, so it stays one row tall and never shifts the chart. The 5 steps
 * map from `mapStatusToPhase`; `cancelled` swaps the whole row for a red banner.
 * The countdown is truthful: a live `MM:SS` shows ONLY while `executed` with a
 * future oracle expiry (decision per plan 22 / story 19 Phase 9).
 */
export function LifecycleRail({ className = '' }: { className?: string }) {
  const { club, oracleSnapshot } = usePredictClub()
  const round = club.activeRound
  const status = round.status
  const mapping = mapStatusToPhase(status)
  const oracleExpiryMs = oracleSnapshot.oracleState?.expiry ?? null

  const isLive = status === 'executed'
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!isLive) return undefined
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [isLive])

  if (mapping.cancelled) {
    return (
      <div
        data-pc-lifecycle
        className={`flex items-center gap-sm bg-surface-container px-md py-sm ${className}`}
        role="alert"
        aria-label="Round lifecycle"
      >
        <span className="material-symbols-outlined text-[18px] text-error" aria-hidden="true">
          cancel
        </span>
        <span className="font-data text-data-sm font-bold text-error">Round cancelled</span>
      </div>
    )
  }

  const seconds = secondsToSettlement({ status, oracleExpiryMs, nowMs })

  return (
    <div
      data-pc-lifecycle
      className={`flex items-center gap-md bg-surface-container px-md py-sm ${className}`}
      aria-label="Round lifecycle"
    >
      <ol className="flex min-w-0 flex-1 items-center" aria-label="Round lifecycle steps">
        {PHASE_ORDER.map((phase, i) => {
          const stepNum = i + 1
          const done = mapping.stepIndex > stepNum
          const current = mapping.stepIndex === stepNum
          return (
            <li key={phase} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-1.5">
                <span
                  className={[
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-data text-[11px] transition-colors',
                    done
                      ? 'border-primary-fixed-dim bg-primary-fixed-dim text-on-primary-fixed'
                      : current
                        ? 'border-primary-fixed-dim text-primary-fixed-dim'
                        : 'border-outline-variant text-on-surface-variant/50',
                  ].join(' ')}
                  aria-current={current ? 'step' : undefined}
                >
                  {done ? (
                    <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                      check
                    </span>
                  ) : (
                    stepNum
                  )}
                </span>
                <span
                  className={[
                    'hidden font-label text-label-caps uppercase tracking-wider sm:inline',
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
                    'mx-1.5 h-px flex-1 transition-colors',
                    done ? 'bg-primary-fixed-dim' : 'bg-outline-variant',
                  ].join(' ')}
                />
              )}
            </li>
          )
        })}
      </ol>

      {/* Truthful countdown / terminal status, right-aligned. */}
      {isLive && seconds !== null ? (
        <span className="flex shrink-0 items-center gap-1 font-data text-data-sm font-bold tabular-nums text-primary-fixed-dim">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            timer
          </span>
          {formatTimer(seconds)}
        </span>
      ) : status === 'settled' ? (
        <span className="shrink-0 font-data text-[11px] uppercase tracking-wider text-tertiary-fixed-dim">
          Awaiting claim
        </span>
      ) : status === 'claimed' ? (
        <span className="shrink-0 font-data text-[11px] uppercase tracking-wider text-primary-fixed-dim">
          Claimed
        </span>
      ) : null}
    </div>
  )
}
