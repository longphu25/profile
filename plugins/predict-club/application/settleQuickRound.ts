import { settleRound, type QuickRound, type QuickRoundParticipant } from '../domain/quickRound'
import type { SuiPredictGateway } from '../infrastructure/suiPredictGateway'
import type { ClubOracleSnapshot } from '../infrastructure/deepbookOracleService'

export interface SettleQuickRoundDeps {
  predictGateway: SuiPredictGateway
  signAndExecute: (tx: any) => Promise<{ digest: string }>
}

export interface ClaimResult {
  address: string
  digest?: string
  error?: string
}

/**
 * Settle a quick round: determine result and claim winning positions.
 * Returns updated round with claim results.
 */
export function resolveSettlement(
  round: QuickRound,
  oracleSnapshot: ClubOracleSnapshot,
): QuickRound | null {
  if (round.status === 'settled' || round.status === 'claimed') return round

  const state = oracleSnapshot.oracleState
  if (!state || state.settlement_price === null || state.settlement_price <= 0) return null

  const PRICE_SCALE = 1e9
  const rawSettlement = Math.floor(state.settlement_price * PRICE_SCALE)
  return settleRound(round, rawSettlement)
}

/**
 * Claim a single participant's winning position.
 * Only winners need to claim — losing positions expire worthless.
 */
export async function claimForParticipant(
  round: QuickRound,
  participant: QuickRoundParticipant,
  managerId: string,
  deps: SettleQuickRoundDeps,
): Promise<ClaimResult> {
  if (!round.result || participant.direction !== round.result) {
    return { address: participant.address, error: 'Position lost — no claim needed' }
  }

  const STRIKE_SCALE = 1e9
  const strikeUsd = round.config.strike / STRIKE_SCALE

  try {
    const tx = await deps.predictGateway.buildClaimTx({
      walletAddress: participant.address,
      managerId,
      oracleId: round.config.oracleId,
      expiry: round.config.expiry,
      strike: strikeUsd,
      isUp: participant.direction === 'UP',
      quantity: participant.quantity,
      tickSize: round.config.tickSize,
      minStrike: round.config.minStrike,
    })

    const result = await deps.signAndExecute(tx)
    return { address: participant.address, digest: result.digest }
  } catch (e: any) {
    return { address: participant.address, error: e.message }
  }
}

/**
 * Check if the current user won and can claim.
 */
export function canClaim(round: QuickRound, walletAddress: string): boolean {
  if (round.status !== 'settled') return false
  if (!round.result) return false
  const participant = round.participants.find(
    (p) => p.address.toLowerCase() === walletAddress.toLowerCase(),
  )
  if (!participant) return false
  if (participant.redeemDigest) return false // already claimed
  return participant.direction === round.result
}
