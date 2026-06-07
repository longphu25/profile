import { Scallop } from '@scallop-io/sui-scallop-sdk'
import type { Transaction } from '@mysten/sui/transactions'

// === Interface (Port) ===

export interface ScallopGateway {
  /** Get health factor for wallet's obligation */
  getHealthFactor(walletAddress: string): Promise<number | null>

  /** Build TX: deposit SUI as collateral + borrow USDC */
  buildBorrowUsdcTx(params: {
    walletAddress: string
    collateralSuiAmount: number
    borrowUsdcAmount: number
    obligationId?: string
  }): Promise<Transaction>
}

// === Factory ===

let scallopInstance: Scallop | null = null

async function getScallop(walletAddress?: string): Promise<Scallop> {
  if (!scallopInstance) {
    scallopInstance = new Scallop({
      networkType: 'testnet',
      walletAddress,
    } as any)
    await scallopInstance.init()
  }
  return scallopInstance
}

export function createScallopGateway(): ScallopGateway {
  return {
    async getHealthFactor(walletAddress) {
      try {
        const scallop = await getScallop(walletAddress)
        const query = await scallop.createScallopQuery()
        const obligations = await query.getObligations(walletAddress)
        if (!obligations.length) return null
        const ob = obligations[0] as any
        return ob.healthFactor ?? ob.health_factor ?? null
      } catch {
        return null
      }
    },

    async buildBorrowUsdcTx(params) {
      const scallop = await getScallop(params.walletAddress)
      const builder = await scallop.createScallopBuilder()
      await builder.init()

      const txBlock = builder.createTxBlock()
      txBlock.setSender(params.walletAddress)

      if (params.obligationId) {
        await txBlock.depositCollateralQuick(
          params.collateralSuiAmount,
          'sui',
          params.obligationId,
        )
        await txBlock.borrowQuick(
          params.borrowUsdcAmount,
          'usdc',
          params.obligationId,
        )
      } else {
        // Open new obligation, deposit collateral, borrow
        const [obligation, obligationKey, hotPotato] = txBlock.openObligation()
        await txBlock.depositCollateralQuick(
          params.collateralSuiAmount,
          'sui',
          obligation,
        )
        await txBlock.borrowQuick(
          params.borrowUsdcAmount,
          'usdc',
          obligation,
          obligationKey,
        )
        txBlock.returnObligation(obligation, hotPotato)
      }

      // Extract underlying Transaction from SuiTxBlock
      return (txBlock as any).txBlock as Transaction
    },
  }
}
