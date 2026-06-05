import type { ClubState, HistoryRow } from '../domain/types'
import { transition } from '../domain/roundLifecycle'

export interface SettlementOutcome {
  roundId: string
  result: 'won' | 'lost' | 'void'
  settledPrice: number
  settledAt: number
}

export function settleRound(
  club: ClubState,
  outcome: SettlementOutcome,
): { ok: boolean; club?: ClubState; error?: string } {
  const result = transition(club.activeRound.status, 'settle')
  if (!result.ok) return { ok: false, error: result.error }

  const pnl =
    outcome.result === 'won'
      ? club.activeRound.totalPledgedDusdc * 0.8
      : outcome.result === 'lost'
        ? -club.activeRound.totalPledgedDusdc
        : 0

  const historyEntry: HistoryRow = {
    id: club.activeRound.id,
    direction: club.activeRound.direction,
    strike: `${club.activeRound.direction} ${club.activeRound.strike}`,
    result: outcome.result,
    pnlDusdc: pnl,
    thesis: club.activeRound.thesis,
    participants: club.members.filter((m) => m.state === 'executed').length,
    claimStatus: outcome.result === 'won' ? 'claimable' : 'none',
    risk: club.activeRound.risk,
    signalBias: club.activeRound.signalBias,
    confidence: club.activeRound.confidence,
    indicatorReasons: club.activeRound.indicatorReasons,
    riskChecks: club.activeRound.riskChecks,
    confirmedAt: club.activeRound.confirmedAt,
  }

  return {
    ok: true,
    club: {
      ...club,
      activeRound: { ...club.activeRound, status: result.newStatus! },
      history: [historyEntry, ...club.history],
    },
  }
}
