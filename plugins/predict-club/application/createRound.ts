import type { ClubState, PredictionRound } from '../domain/types'
import { validateRoundParams, type CreateRoundParams } from '../domain/policies'
import { computeConsensus } from '../domain/indicatorConsensus'

export interface CreateRoundResult {
  ok: boolean
  club?: ClubState
  error?: string
}

let roundCounter = 42

export function createRound(club: ClubState, params: CreateRoundParams): CreateRoundResult {
  const validation = validateRoundParams(params)
  if (!validation.valid) {
    return { ok: false, error: validation.errors.join('; ') }
  }

  const consensus = computeConsensus(params.indicators)
  roundCounter++

  const round: PredictionRound = {
    id: `ROUND-${String(roundCounter).padStart(3, '0')}`,
    market: params.market,
    btcSpot: 68421.8,
    direction: params.direction,
    strike: params.strike,
    lowerStrike: params.lowerStrike,
    upperStrike: params.upperStrike,
    expiryLabel: `${params.expiryMinutes}m`,
    expiryMinutes: params.expiryMinutes,
    totalPledgedDusdc: 0,
    fundingDusdc: 0,
    fundingTargetDusdc: params.suggestedDusdc * 4,
    risk: 'ready',
    status: 'draft',
    thesis: params.thesis,
    oracle: params.oracle,
    suggestedDusdc: params.suggestedDusdc,
    signalBias: consensus.bias,
    confidence: consensus.confidence,
    indicators: params.indicators,
  }

  return {
    ok: true,
    club: { ...club, activeRound: round },
  }
}
