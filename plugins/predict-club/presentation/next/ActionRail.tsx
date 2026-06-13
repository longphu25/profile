import { usePredictClub } from '../usePredictClub'
import type { RoundStatus } from '../../domain/types'
import { PanelShell } from './PanelShell'

/**
 * Primary Action Rail (R2) — the single source of "what do I do next".
 *
 * Consumes the already-derived `primaryAction` from PredictClubContext (no
 * forked logic) and gates execution on `riskEvaluation`. Exactly one element on
 * the page is ever styled as the primary CTA. When the action is blocked, the
 * button is disabled and the blocking reasons are listed beneath it.
 */

/** The guided flow steps, in order. Drives the breadcrumb above the CTA. */
const FLOW_STEPS = ['Connect', 'Manager', 'Fund', 'Review', 'Execute', 'Claim'] as const
type FlowStep = (typeof FLOW_STEPS)[number]

/** Map round status + connection to the current step in the guided flow. */
function currentStep(connected: boolean, status: RoundStatus, managerReady: boolean): FlowStep {
  if (!connected) return 'Connect'
  if (!managerReady) return 'Manager'
  switch (status) {
    case 'draft':
    case 'open':
      return 'Review'
    case 'confirmed':
    case 'funding':
      return 'Fund'
    case 'executed':
      return 'Execute'
    case 'settled':
    case 'claimed':
      return 'Claim'
    default:
      return 'Review'
  }
}

/** Execution-phase actions must additionally pass the risk gate. */
function isExecuteLabel(label: string): boolean {
  return label === 'Execute Trade'
}

export function ActionRail({ className }: { className?: string }) {
  const { primaryAction, riskEvaluation, club, context, predictManagerId } = usePredictClub()
  const status = club.activeRound.status
  const managerReady = Boolean(predictManagerId)
  const step = currentStep(context.isConnected, status, managerReady)

  // Only execution is risk-gated here; other phases (connect/fund/claim) are
  // always actionable so the user can move forward to resolve their blocker.
  const gated = isExecuteLabel(primaryAction.label)
  const blocked = gated && !riskEvaluation.canExecute
  const reasons = blocked
    ? [...riskEvaluation.blockingReasons, ...riskEvaluation.warningReasons]
    : []

  return (
    <PanelShell bordered={false} title="Next Action" icon="bolt" className={className}>
      <div className="flex flex-col gap-sm">
        {/* Guided flow breadcrumb */}
        <ol className="flex items-center gap-1 overflow-x-auto" aria-label="Round flow">
          {FLOW_STEPS.map((s, i) => {
            const active = s === step
            const done = FLOW_STEPS.indexOf(step) > i
            return (
              <li key={s} className="flex items-center gap-1 shrink-0">
                <span
                  className={[
                    'font-label text-label-caps uppercase tracking-wider px-xs py-[2px] rounded-sm transition-colors',
                    active
                      ? 'bg-primary-fixed-dim text-on-primary-fixed'
                      : done
                        ? 'text-primary-fixed-dim'
                        : 'text-on-surface-variant/50',
                  ].join(' ')}
                >
                  {s}
                </span>
                {i < FLOW_STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={done ? 'text-primary-fixed-dim' : 'text-outline-variant'}
                  >
                    ›
                  </span>
                )}
              </li>
            )
          })}
        </ol>

        {/* The one primary CTA */}
        <button
          type="button"
          onClick={primaryAction.action}
          disabled={blocked}
          className={[
            'w-full h-11 rounded-lg font-headline text-headline-md flex items-center justify-center gap-2 transition-colors',
            blocked
              ? 'bg-surface-variant text-on-surface-variant border border-outline cursor-not-allowed'
              : 'bg-primary-fixed-dim text-on-primary-fixed hover:bg-primary-container cursor-pointer glow-mint',
          ].join(' ')}
          aria-disabled={blocked}
        >
          {blocked && <span className="material-symbols-outlined text-[18px]">lock</span>}
          {primaryAction.label}
        </button>

        {/* Disabled reasons (execution only) */}
        {blocked && reasons.length > 0 && (
          <ul className="flex flex-col gap-1" aria-label="Blocking reasons">
            {reasons.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-1 font-data text-data-sm text-on-surface-variant"
              >
                <span
                  className={[
                    'material-symbols-outlined text-[14px] mt-[1px]',
                    r.severity === 'blocking' ? 'text-error' : 'text-tertiary-fixed-dim',
                  ].join(' ')}
                >
                  {r.severity === 'blocking' ? 'error' : 'warning'}
                </span>
                <span>{r.message ?? r.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PanelShell>
  )
}
