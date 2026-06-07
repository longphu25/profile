import type { Transaction } from '@mysten/sui/transactions'
import { createScallopGateway } from '../infrastructure/scallopGateway'
import { canBorrowSafely } from '../domain/policies'

export interface BorrowDeps {
  walletAddress: string
  signAndExecute: (tx: Transaction) => Promise<{ digest: string }>
}

export interface BorrowUsdcParams {
  collateralSui: number
  borrowUsdc: number
  obligationId?: string
}

export async function borrowUsdc(
  deps: BorrowDeps,
  params: BorrowUsdcParams,
): Promise<{ ok: boolean; digest?: string; error?: string }> {
  const gateway = createScallopGateway()
  if (params.obligationId) {
    const health = await gateway.getHealthFactor(deps.walletAddress)
    if (health !== null && !canBorrowSafely(health)) {
      return { ok: false, error: `Health factor too low (${health.toFixed(2)}). Min 1.5 required.` }
    }
  }
  try {
    const tx = await gateway.buildBorrowUsdcTx({
      walletAddress: deps.walletAddress,
      collateralSuiAmount: params.collateralSui,
      borrowUsdcAmount: params.borrowUsdc,
      obligationId: params.obligationId,
    })
    const result = await deps.signAndExecute(tx)
    return { ok: true, digest: result.digest }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Borrow failed' }
  }
}
