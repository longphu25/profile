import { usePredictClub } from '../usePredictClub'
import type { RoundStatus, Direction } from '../../domain/types'
import type { RiskCheck } from '../../domain/riskGate'

/**
 * Shared action-model selector (C2 seam).
 *
 * Derives "what is the one next action" from the already-computed
 * `primaryAction` + `riskEvaluation` in context. This is the ONLY place that
 * logic lives, so the pro `ActionDock` and a future casual "lite mode" toggle
 * consume the same model instead of re-deriving (decision 10 of plan 22). No
 * forked domain logic: the labels/action come straight from context.
 */

export const FLOW_STEPS = ['Connect', 'Manager', 'Fund', 'Review', 'Execute', 'Claim'] as const
export type FlowStep = (typeof FLOW_STEPS)[number]

/** Map round status + connection to the current step in the guided flow. */
export function currentStep(
  connected: boolean,
  status: RoundStatus,
  managerReady: boolean,
): FlowStep {
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

/** The execute phase is the only one that takes a direction + risk gate. */
export function isExecuteLabel(label: string): boolean {
  return label === 'Execute Trade'
}

export interface ActionModel {
  step: FlowStep
  /** Current step index into FLOW_STEPS (for breadcrumb done/active styling). */
  stepIndex: number
  label: string
  action: () => void
  /** Execute phase: direction picker + risk gate apply. */
  isExecute: boolean
  /** Execute and the risk gate failed → CTA disabled. */
  blocked: boolean
  canExecute: boolean
  reasons: RiskCheck[]
  /** One-tap directional execution, persists direction+strike on success. */
  execute: (direction: Direction) => Promise<{ ok: boolean; error?: string }>
  /** Round economics for the dock readout (real, not mock). */
  suggestedDusdc: number
  pledgedDusdc: number
}

export function useActionModel(): ActionModel {
  const { primaryAction, riskEvaluation, club, context, predictManagerId, actions } =
    usePredictClub()
  const round = club.activeRound
  const status = round.status
  const managerReady = Boolean(predictManagerId)
  const step = currentStep(context.isConnected, status, managerReady)

  const isExecute = isExecuteLabel(primaryAction.label)
  const blocked = isExecute && !riskEvaluation.canExecute
  const reasons = blocked
    ? [...riskEvaluation.blockingReasons, ...riskEvaluation.warningReasons]
    : []

  return {
    step,
    stepIndex: FLOW_STEPS.indexOf(step),
    label: primaryAction.label,
    action: primaryAction.action,
    isExecute,
    blocked,
    canExecute: riskEvaluation.canExecute,
    reasons,
    execute: actions.executeRound,
    suggestedDusdc: round.suggestedDusdc,
    pledgedDusdc: round.totalPledgedDusdc,
  }
}
