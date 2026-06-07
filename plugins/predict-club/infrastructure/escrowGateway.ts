import { Transaction } from '@mysten/sui/transactions'
import {
  PREDICT_CLUB_PACKAGE_ID,
  CLUB_ESCROW_MARKET_ID,
} from '../../../src/constants/predict-club'

// Coin type constants (testnet)
const DUSDC_TYPE =
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC'
const SUI_TYPE = '0x2::sui::SUI'

const COIN_TYPES: Record<string, string> = {
  DUSDC: DUSDC_TYPE,
  USDC: DUSDC_TYPE, // testnet: USDC uses DUSDC type placeholder until real USDC deployed
  SUI: SUI_TYPE,
}

// === Interface (Port) ===

export interface EscrowGateway {
  buildCreateOfferTx(params: {
    sender: string
    offerCoinType: string
    wantCoinType: string
    offerCoinId: string
    wantAmount: bigint
    recipient?: string
    roundId?: string
    expiresInEpochs: number
  }): Transaction

  buildFillOfferTx(params: {
    sender: string
    offerCoinType: string
    wantCoinType: string
    offerId: string
    paymentCoinId: string
  }): Transaction

  buildCancelOfferTx(params: {
    sender: string
    offerCoinType: string
    wantCoinType: string
    offerId: string
  }): Transaction
}

// === Factory ===

export function createEscrowGateway(): EscrowGateway {
  const pkg = PREDICT_CLUB_PACKAGE_ID
  const market = CLUB_ESCROW_MARKET_ID

  return {
    buildCreateOfferTx(params) {
      const tx = new Transaction()
      tx.setSender(params.sender)

      const [offer] = tx.moveCall({
        target: `${pkg}::exchange::create_offer`,
        typeArguments: [params.offerCoinType, params.wantCoinType],
        arguments: [
          tx.object(market),
          tx.object(params.offerCoinId),
          tx.pure.u64(params.wantAmount),
          params.recipient
            ? tx.pure.option('address', params.recipient)
            : tx.pure.option('address', null),
          params.roundId
            ? tx.pure.option('address', params.roundId)
            : tx.pure.option('address', null),
          tx.pure.u64(params.expiresInEpochs),
        ],
      })

      // Transfer the returned offer to sender (it's an owned object)
      tx.transferObjects([offer], params.sender)

      return tx
    },

    buildFillOfferTx(params) {
      const tx = new Transaction()
      tx.setSender(params.sender)

      const [offeredCoin, change] = tx.moveCall({
        target: `${pkg}::exchange::fill_offer`,
        typeArguments: [params.offerCoinType, params.wantCoinType],
        arguments: [
          tx.object(market),
          tx.object(params.offerId),
          tx.object(params.paymentCoinId),
        ],
      })

      // Transfer received coin and change to sender
      tx.transferObjects([offeredCoin], params.sender)
      tx.transferObjects([change], params.sender)

      return tx
    },

    buildCancelOfferTx(params) {
      const tx = new Transaction()
      tx.setSender(params.sender)

      const [refund] = tx.moveCall({
        target: `${pkg}::exchange::cancel_offer`,
        typeArguments: [params.offerCoinType, params.wantCoinType],
        arguments: [
          tx.object(market),
          tx.object(params.offerId),
        ],
      })

      tx.transferObjects([refund], params.sender)

      return tx
    },
  }
}

// === Helper ===

export function resolveCoinType(symbol: string): string {
  return COIN_TYPES[symbol] ?? symbol
}
