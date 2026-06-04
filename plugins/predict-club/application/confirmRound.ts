import type { ClubState } from '../domain/types'
import { transition } from '../domain/roundLifecycle'
import { evaluateRiskGate, type RiskGateInput } from '../domain/riskGate'

export interface ConfirmRoundResult {
  ok: boolean
  club?: ClubState
  error?: string
}

export function confirmRound(club: ClubState, riskInput: RiskGateInput): ConfirmRoundResult {
  const risk = evaluateRiskGate(riskInput)
  if (!risk.canExecute) {
    const reasons = risk.checks.filter((c) => !c.passed).map((c) => c.message || c.label)
    return { ok: false, error: `Blocked: ${reasons.join(', ')}` }
  }

  const result = transition(club.activeRound.status, 'confirm')
  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  return {
    ok: true,
    club: {
      ...club,
      activeRound: {
        ...club.activeRound,
        status: result.newStatus!,
        risk: risk.state,
      },
    },
  }
}
