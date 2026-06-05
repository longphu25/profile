import type { ClubState, Direction } from '../domain/types'
import type { RiskGateInput } from '../domain/riskGate'
import { evaluateRiskGate } from '../domain/riskGate'
import type { Transaction } from '@mysten/sui/transactions'

export interface TradePlan {
  direction: Direction
  strike: number
  lowerStrike?: number
  upperStrike?: number
  amountDusdc: number
  oracleId: string
  /** Oracle expiry timestamp in ms */
  expiryMs: number
  expiryMinutes: number
  managerId: string
  walletAddress: string
  /** From oracle entry */
  tickSize: number
  minStrike: number
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

export interface SuiPredictGateway {
  buildMintTx(params: {
    walletAddress: string
    managerId: string
    direction: Direction
    strike: number
    amountDusdc: number
    oracleId: string
    expiry: number
    tickSize: number
    minStrike: number
  }): Promise<Transaction>

  buildMintRangeTx(params: {
    walletAddress: string
    managerId: string
    lowerStrike: number
    upperStrike: number
    amountDusdc: number
    oracleId: string
    expiry: number
    tickSize: number
    minStrike: number
  }): Promise<Transaction>
}

export async function executeTradeplan(
  club: ClubState,
  memberId: string,
  plan: TradePlan,
  riskInput: RiskGateInput,
  gateway: SuiPredictGateway,
  signer: (tx: Transaction) => Promise<TransactionResult>,
): Promise<ExecuteResult> {
  // 1. Risk gate
  const riskEval = evaluateRiskGate(riskInput)
  if (!riskEval.canExecute) {
    const reasons = riskEval.checks.filter((c) => !c.passed).map((c) => c.message ?? c.label)
    return { ok: false, error: `Risk gate blocked: ${reasons.join('; ')}` }
  }

  // 2. Build PTB
  let transaction: Transaction
  try {
    if (plan.direction === 'RANGE') {
      transaction = await gateway.buildMintRangeTx({
        walletAddress: plan.walletAddress,
        managerId: plan.managerId,
        lowerStrike: plan.lowerStrike!,
        upperStrike: plan.upperStrike!,
        amountDusdc: plan.amountDusdc,
        oracleId: plan.oracleId,
        expiry: plan.expiryMs,
        tickSize: plan.tickSize,
        minStrike: plan.minStrike,
      })
    } else {
      transaction = await gateway.buildMintTx({
        walletAddress: plan.walletAddress,
        managerId: plan.managerId,
        direction: plan.direction,
        strike: plan.strike,
        amountDusdc: plan.amountDusdc,
        oracleId: plan.oracleId,
        expiry: plan.expiryMs,
        tickSize: plan.tickSize,
        minStrike: plan.minStrike,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PTB build failed'
    return { ok: false, error: message }
  }

  // 3. Sign & execute
  try {
    const result = await signer(transaction)

    const updatedMembers = club.members.map((m) =>
      m.id === memberId ? { ...m, state: 'executed' as const } : m,
    )
    return {
      ok: true,
      digest: result.digest,
      club: { ...club, members: updatedMembers },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transaction failed'
    return { ok: false, error: message }
  }
}
