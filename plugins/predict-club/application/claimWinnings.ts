import type { Transaction } from '@mysten/sui/transactions'
import type { ClubState, HistoryRow } from '../domain/types'
import { createSuiPredictGateway } from '../infrastructure/suiPredictGateway'

export interface ClaimDeps {
  signAndExecute: (tx: Transaction) => Promise<{ digest: string }>
  walletAddress: string
  managerId: string
}

export interface ClaimParams {
  historyId: string
  oracleId: string
  expiry: number
  strike: number
  isUp: boolean
  tickSize: number
  minStrike: number
}

export async function claimWinnings(
  club: ClubState,
  deps: ClaimDeps,
  params: ClaimParams,
): Promise<{ ok: boolean; club?: ClubState; digest?: string; error?: string }> {
  const entry = club.history.find((h) => h.id === params.historyId)
  if (!entry) return { ok: false, error: 'History entry not found' }
  if (entry.claimStatus !== 'claimable') return { ok: false, error: 'Not claimable' }

  const gateway = createSuiPredictGateway()
  const tx = await gateway.buildClaimTx({
    walletAddress: deps.walletAddress,
    managerId: deps.managerId,
    oracleId: params.oracleId,
    expiry: params.expiry,
    strike: params.strike,
    isUp: params.isUp,
    tickSize: params.tickSize,
    minStrike: params.minStrike,
  })

  try {
    const result = await deps.signAndExecute(tx)
    const updatedHistory: HistoryRow[] = club.history.map((h) =>
      h.id === params.historyId ? { ...h, claimStatus: 'claimed' as const } : h,
    )
    return {
      ok: true,
      digest: result.digest,
      club: { ...club, history: updatedHistory },
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Claim failed' }
  }
}
