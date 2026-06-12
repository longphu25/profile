import { Transaction } from '@mysten/sui/transactions'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { DeepBookClient, testnetCoins, testnetPools, testnetPackageIds } from '@mysten/deepbook-v3'
import {
  PREDICT_CLUB_PACKAGE_ID,
  CLUB_ESCROW_MARKET_ID,
  TESTNET_RPC_URL,
} from '../../../src/constants/predict-club'

const RPC_URL = TESTNET_RPC_URL

// === Interface (Port) ===

export interface FundingGateway {
  /** Swap SUI → USDC via DeepBook SUI_USDC pool */
  buildSwapSuiToUsdcTx(params: {
    sender: string
    suiAmount: number
    minUsdcOut: number
  }): Transaction

  /** Compose: swap SUI → USDC, then fill escrow offer to get DUSDC */
  buildSwapAndFillTx(params: {
    sender: string
    suiAmount: number
    minUsdcOut: number
    offerId: string
    offerCoinType: string
    wantCoinType: string
  }): Transaction
}

// === Factory ===

export function createFundingGateway(): FundingGateway {
  function makeDeepBookClient(sender: string): DeepBookClient {
    const client = new SuiGrpcClient({ network: 'testnet', baseUrl: RPC_URL })
    return new DeepBookClient({
      client,
      address: sender,
      network: 'testnet',
      coins: testnetCoins,
      pools: testnetPools,
      packageIds: testnetPackageIds,
    })
  }

  return {
    buildSwapSuiToUsdcTx(params) {
      const tx = new Transaction()
      tx.setSender(params.sender)

      const db = makeDeepBookClient(params.sender)
      db.deepBook.swapExactBaseForQuote({
        poolKey: 'SUI_USDC',
        amount: params.suiAmount,
        deepAmount: 0,
        minOut: params.minUsdcOut,
      })(tx)

      return tx
    },

    buildSwapAndFillTx(params) {
      const tx = new Transaction()
      tx.setSender(params.sender)

      // Step 1: swap SUI → USDC
      const db = makeDeepBookClient(params.sender)
      db.deepBook.swapExactBaseForQuote({
        poolKey: 'SUI_USDC',
        amount: params.suiAmount,
        deepAmount: 0,
        minOut: params.minUsdcOut,
      })(tx)

      // Step 2: fill the escrow offer with the USDC received
      // Note: the USDC coin from swap is auto-merged by PTB runtime
      const [offeredCoin, change] = tx.moveCall({
        target: `${PREDICT_CLUB_PACKAGE_ID}::exchange::fill_offer`,
        typeArguments: [params.offerCoinType, params.wantCoinType],
        arguments: [
          tx.object(CLUB_ESCROW_MARKET_ID),
          tx.object(params.offerId),
          tx.object(params.sender), // placeholder - caller must provide actual USDC coin
        ],
      })

      tx.transferObjects([offeredCoin], params.sender)
      tx.transferObjects([change], params.sender)

      return tx
    },
  }
}
