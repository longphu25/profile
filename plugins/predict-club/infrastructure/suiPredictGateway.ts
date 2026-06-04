import { Transaction } from '@mysten/sui/transactions'
import type { Direction } from '../domain/types'

/**
 * DeepBook Predict package address on Sui Testnet.
 * This is the move package containing mint, mint_range, and claim entry functions.
 */
const PREDICT_PACKAGE_ID = '0x0000000000000000000000000000000000000000000000000000000000000001' // placeholder — replace with deployed testnet package

/**
 * DeepBook pool address used for SUI→USDC swap on testnet.
 */
const DEEPBOOK_POOL_ID = '0x0000000000000000000000000000000000000000000000000000000000000002' // placeholder — replace with testnet pool

/**
 * Module names within the predict package.
 */
const PREDICT_MODULE = 'predict'
const DEEPBOOK_SWAP_MODULE = 'pool'

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

  buildClaimTx(params: { predictManagerId: string; positionId: string }): Transaction

  buildSwapSuiToUsdcTx(params: {
    amountSui: number
    minUsdcOut: number
    preserveGasSui: number
  }): Transaction
}

/**
 * Creates a SuiPredictGateway that constructs Programmable Transaction Blocks
 * for DeepBook Predict operations. Does NOT sign — returns Transaction objects
 * ready for wallet signing.
 */
export function createSuiPredictGateway(): SuiPredictGateway {
  return {
    buildMintTx(params) {
      const tx = new Transaction()

      tx.moveCall({
        target: `${PREDICT_PACKAGE_ID}::${PREDICT_MODULE}::mint`,
        arguments: [
          tx.object(params.predictManagerId),
          tx.pure.u8(params.direction === 'UP' ? 0 : 1),
          tx.pure.u64(params.strike),
          tx.pure.u64(params.amountDusdc),
          tx.object(params.oracleId),
          tx.pure.u64(params.expiry),
        ],
      })

      return tx
    },

    buildMintRangeTx(params) {
      const tx = new Transaction()

      tx.moveCall({
        target: `${PREDICT_PACKAGE_ID}::${PREDICT_MODULE}::mint_range`,
        arguments: [
          tx.object(params.predictManagerId),
          tx.pure.u64(params.lowerStrike),
          tx.pure.u64(params.upperStrike),
          tx.pure.u64(params.amountDusdc),
          tx.object(params.oracleId),
          tx.pure.u64(params.expiry),
        ],
      })

      return tx
    },

    buildClaimTx(params) {
      const tx = new Transaction()

      tx.moveCall({
        target: `${PREDICT_PACKAGE_ID}::${PREDICT_MODULE}::claim`,
        arguments: [tx.object(params.predictManagerId), tx.object(params.positionId)],
      })

      return tx
    },

    buildSwapSuiToUsdcTx(params) {
      const tx = new Transaction()

      // Split out the swap amount from gas coin, preserving gas
      const swapAmountMist = params.amountSui * 1_000_000_000
      const preserveMist = params.preserveGasSui * 1_000_000_000
      const [swapCoin] = tx.splitCoins(tx.gas, [swapAmountMist - preserveMist])

      tx.moveCall({
        target: `${PREDICT_PACKAGE_ID}::${DEEPBOOK_SWAP_MODULE}::swap_exact_base_for_quote`,
        arguments: [tx.object(DEEPBOOK_POOL_ID), swapCoin, tx.pure.u64(params.minUsdcOut)],
      })

      return tx
    },
  }
}
