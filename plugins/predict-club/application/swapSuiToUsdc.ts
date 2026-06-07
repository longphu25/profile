import type { Transaction } from '@mysten/sui/transactions'
import { createFundingGateway } from '../infrastructure/fundingGateway'

export interface SwapDeps {
  signAndExecute: (tx: Transaction) => Promise<{ digest: string }>
  sender: string
}

export interface SwapSuiToUsdcParams {
  /** Amount in SUI (whole units, e.g. 1.5 = 1.5 SUI) */
  suiAmount: number
  /** Minimum USDC out (slippage protected) */
  minUsdcOut: number
}

export async function swapSuiToUsdc(
  deps: SwapDeps,
  params: SwapSuiToUsdcParams,
): Promise<{ ok: boolean; digest?: string; error?: string }> {
  try {
    const gateway = createFundingGateway()
    const tx = gateway.buildSwapSuiToUsdcTx({
      sender: deps.sender,
      suiAmount: params.suiAmount,
      minUsdcOut: params.minUsdcOut,
    })
    const result = await deps.signAndExecute(tx)
    return { ok: true, digest: result.digest }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Swap failed' }
  }
}
