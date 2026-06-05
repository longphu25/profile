import type { ClubState } from '../domain/types'
import { transition } from '../domain/roundLifecycle'
import { evaluateRiskGate, type RiskGateInput } from '../domain/riskGate'
import { computeConsensus } from '../domain/indicatorConsensus'

export interface ConfirmRoundResult {
  ok: boolean
  club?: ClubState
  error?: string
}

export function confirmRound(club: ClubState, riskInput: RiskGateInput): ConfirmRoundResult {
  const risk = evaluateRiskGate(riskInput)
  if (!risk.canConfirm) {
    const reasons = risk.checks.filter((c) => !c.passed).map((c) => c.message || c.label)
    return { ok: false, error: `Blocked: ${reasons.join(', ')}` }
  }

  const result = transition(club.activeRound.status, 'confirm')
  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  const consensus = computeConsensus(club.activeRound.indicators)

  return {
    ok: true,
    club: {
      ...club,
      activeRound: {
        ...club.activeRound,
        status: result.newStatus!,
        risk: risk.state,
        signalBias: consensus.bias,
        confidence: consensus.confidence,
        indicatorReasons: consensus.reasons,
        riskChecks: risk.checks.map((check) => ({
          id: check.id,
          label: check.label,
          passed: check.passed,
          severity: check.severity,
          message: check.message,
        })),
        confirmedAt: Date.now(),
      },
    },
  }
}
