import type { Transaction } from '@mysten/sui/transactions'
import type { TransactionResult } from '../../../src/sui-dashboard/sui-types'
import type { ClubState } from '../domain/types'

/** Subset of SuiPredictGateway needed for claim operations */
export interface ClaimGateway {
  buildClaimTx(params: { predictManagerId: string; positionId: string }): Transaction
}

export interface ClaimSettlementResult {
  ok: boolean
  digest?: string
  club?: ClubState
  error?: string
}

export async function claimSettlement(
  club: ClubState,
  claimId: string,
  gateway: ClaimGateway,
  signer: (tx: Transaction) => Promise<TransactionResult>,
): Promise<ClaimSettlementResult> {
  // 1. Find the claim by claimId
  const claimIndex = club.claims.findIndex((c) => c.id === claimId)
  if (claimIndex === -1) {
    return { ok: false, error: `Claim '${claimId}' not found` }
  }

  const claim = club.claims[claimIndex]

  // 2. Reject if already claimed (status !== 'ready')
  if (claim.status !== 'ready') {
    return {
      ok: false,
      error: `Claim '${claimId}' is not in ready status (current: ${claim.status})`,
    }
  }

  // 3. Build claim PTB via gateway
  // Use the claim's roundId as predictManagerId and claimId as positionId
  const transaction = gateway.buildClaimTx({
    predictManagerId: claim.roundId,
    positionId: claim.id,
  })

  // 4. Call signer for wallet signature
  try {
    const result = await signer(transaction)

    // 5. On success: remove claimed item from claims, update history
    const remainingClaims = club.claims.filter((c) => c.id !== claimId)

    // Update the corresponding history row's claimStatus
    const updatedHistory = club.history.map((h) => {
      if (h.id === claim.roundId) {
        // Check if all claims for this round are now processed
        const roundClaimsLeft = remainingClaims.filter((c) => c.roundId === claim.roundId)
        const allClaimed = roundClaimsLeft.length === 0
        return { ...h, claimStatus: allClaimed ? ('claimed' as const) : h.claimStatus }
      }
      return h
    })

    const updatedClub: ClubState = {
      ...club,
      claims: remainingClaims,
      history: updatedHistory,
    }

    return { ok: true, digest: result.digest, club: updatedClub }
  } catch (error) {
    // 6. On failure: keep claim status unchanged
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: `Claim transaction failed: ${message}` }
  }
}
