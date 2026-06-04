import type { ClubState, Direction } from '../domain/types'
import type { RiskGateInput } from '../domain/riskGate'
import { evaluateRiskGate } from '../domain/riskGate'
import { computeConsensus } from '../domain/indicatorConsensus'
import type { Transaction } from '@mysten/sui/transactions'

export interface TradePlan {
  direction: Direction
  strike: number
  lowerStrike?: number
  upperStrike?: number
  amountDusdc: number
  oracle: string
  expiryMinutes: number
  predictManagerAddress: string
}

export interface ExecuteResult {
  ok: boolean
  digest?: string
  club?: ClubState
  error?: string
}

export interface TransactionResult {
  digest: string
  effects?: unknown
}

/** Gateway interface for PTB construction (implemented in infrastructure layer) */
export interface SuiPredictGateway {
  buildMintTx(params: {
    predictManagerId: string
    direction: Direction
    strike: number
    amountDusdc: number
    oracleId: string
    expiry: number
  }): Transaction

  buildMintRangeTx(params: {
    predictManagerId: string
    lowerStrike: number
    upperStrike: number
    amountDusdc: number
    oracleId: string
    expiry: number
  }): Transaction
}

/**
 * Coordinates trade execution: risk gate → PTB construction → wallet sign → state update.
 * No private key handling at any point.
 */
export async function executeTradeplan(
  club: ClubState,
  memberId: string,
  plan: TradePlan,
  gateway: SuiPredictGateway,
  signer: (tx: Transaction) => Promise<TransactionResult>,
): Promise<ExecuteResult> {
  // 1. Build RiskGateInput from club state and evaluate
  const consensus = computeConsensus(club.activeRound.indicators)
  const member = club.members.find((m) => m.id === memberId)

  const riskInput: RiskGateInput = {
    oracleLastUpdate: Date.now(), // assume fresh for execution context
    oracleStaleThresholdMs: 60_000,
    expiryMinutes: plan.expiryMinutes,
    minSafeExpiryMinutes: 5,
    memberDusdc: member?.pledgedDusdc ?? 0,
    suggestedDusdc: plan.amountDusdc,
    signalBias: consensus.bias,
    indicators: club.activeRound.indicators,
  }

  const riskEval = evaluateRiskGate(riskInput)

  // 2. If risk state is 'blocked', return error with blocking reasons
  if (riskEval.state === 'blocked') {
    const reasons = riskEval.checks.filter((c) => !c.passed).map((c) => c.message ?? c.label)
    return { ok: false, error: `Risk gate blocked: ${reasons.join('; ')}` }
  }

  // 3. Build PTB via gateway based on direction
  let transaction: Transaction
  if (plan.direction === 'RANGE') {
    transaction = gateway.buildMintRangeTx({
      predictManagerId: plan.predictManagerAddress,
      lowerStrike: plan.lowerStrike!,
      upperStrike: plan.upperStrike!,
      amountDusdc: plan.amountDusdc,
      oracleId: plan.oracle,
      expiry: plan.expiryMinutes,
    })
  } else {
    transaction = gateway.buildMintTx({
      predictManagerId: plan.predictManagerAddress,
      direction: plan.direction,
      strike: plan.strike,
      amountDusdc: plan.amountDusdc,
      oracleId: plan.oracle,
      expiry: plan.expiryMinutes,
    })
  }

  // 4. Call signer to get wallet signature
  try {
    const result = await signer(transaction)

    // 5. On success: transition member state to 'executed', store digest
    const updatedMembers = club.members.map((m) =>
      m.id === memberId ? { ...m, state: 'executed' as const } : m,
    )

    const updatedClub: ClubState = {
      ...club,
      members: updatedMembers,
    }

    return { ok: true, digest: result.digest, club: updatedClub }
  } catch (error) {
    // 6. On failure: keep member state as 'accepted', return error
    const message = error instanceof Error ? error.message : 'Transaction failed'
    return { ok: false, error: message }
  }
}
