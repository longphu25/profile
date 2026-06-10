import type { Direction } from '../domain/types'
import {
  isJoinWindowOpen,
  hasJoined,
  type QuickRound,
  type QuickRoundParticipant,
} from '../domain/quickRound'
import type { SuiPredictGateway } from '../infrastructure/suiPredictGateway'

export interface JoinQuickRoundParams {
  direction: Direction
  quantity: number
  walletAddress: string
  managerId: string
  memberName: string
}

export interface JoinQuickRoundDeps {
  predictGateway: SuiPredictGateway
  signAndExecute: (tx: any) => Promise<{ digest: string }>
}

export interface JoinQuickRoundResult {
  txDigest: string
  participant: QuickRoundParticipant
}

/**
 * Member joins a quick round by minting a binary position.
 */
export async function joinQuickRound(
  round: QuickRound,
  params: JoinQuickRoundParams,
  deps: JoinQuickRoundDeps,
): Promise<JoinQuickRoundResult> {
  if (!isJoinWindowOpen(round)) {
    throw new Error('Join window is closed')
  }
  if (hasJoined(round, params.walletAddress)) {
    throw new Error('Already joined this round')
  }
  if (params.quantity > round.config.maxQuantityPerMember) {
    throw new Error(`Max ${round.config.maxQuantityPerMember} DUSDC per member`)
  }

  const STRIKE_SCALE = 1e9
  const strikeUsd = round.config.strike / STRIKE_SCALE

  const tx = await deps.predictGateway.buildMintTx({
    walletAddress: params.walletAddress,
    managerId: params.managerId,
    direction: params.direction,
    strike: strikeUsd,
    amountDusdc: params.quantity,
    oracleId: round.config.oracleId,
    expiry: round.config.expiry,
    tickSize: round.config.tickSize,
    minStrike: round.config.minStrike,
  })

  const result = await deps.signAndExecute(tx)

  const participant: QuickRoundParticipant = {
    address: params.walletAddress,
    name: params.memberName,
    direction: params.direction,
    quantity: params.quantity,
    joinedAt: Date.now(),
    txDigest: result.digest,
  }

  return { txDigest: result.digest, participant }
}
