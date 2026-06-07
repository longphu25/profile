import { Transaction } from '@mysten/sui/transactions'
import { createEscrowGateway, resolveCoinType } from '../infrastructure/escrowGateway'
import type { EscrowOfferView } from '../domain/types'

export interface OnChainEscrowDeps {
  signAndExecute: (tx: Transaction) => Promise<{ digest: string }>
  sender: string
}

export interface CreateOfferOnChainParams {
  offerAsset: 'DUSDC' | 'USDC' | 'SUI'
  wantAsset: 'DUSDC' | 'USDC' | 'SUI'
  offerCoinId: string
  wantAmount: bigint
  recipient?: string
  roundId?: string
  expiresInEpochs: number
}

export async function createOfferOnChain(
  deps: OnChainEscrowDeps,
  params: CreateOfferOnChainParams,
): Promise<{ digest: string }> {
  const gateway = createEscrowGateway()
  const tx = gateway.buildCreateOfferTx({
    sender: deps.sender,
    offerCoinType: resolveCoinType(params.offerAsset),
    wantCoinType: resolveCoinType(params.wantAsset),
    offerCoinId: params.offerCoinId,
    wantAmount: params.wantAmount,
    recipient: params.recipient,
    roundId: params.roundId,
    expiresInEpochs: params.expiresInEpochs,
  })
  return deps.signAndExecute(tx)
}

export async function fillOfferOnChain(
  deps: OnChainEscrowDeps,
  offer: EscrowOfferView,
  paymentCoinId: string,
): Promise<{ digest: string }> {
  const gateway = createEscrowGateway()
  const tx = gateway.buildFillOfferTx({
    sender: deps.sender,
    offerCoinType: resolveCoinType(offer.offerAsset),
    wantCoinType: resolveCoinType(offer.wantAsset),
    offerId: offer.id,
    paymentCoinId,
  })
  return deps.signAndExecute(tx)
}

export async function cancelOfferOnChain(
  deps: OnChainEscrowDeps,
  offer: EscrowOfferView,
): Promise<{ digest: string }> {
  const gateway = createEscrowGateway()
  const tx = gateway.buildCancelOfferTx({
    sender: deps.sender,
    offerCoinType: resolveCoinType(offer.offerAsset),
    wantCoinType: resolveCoinType(offer.wantAsset),
    offerId: offer.id,
  })
  return deps.signAndExecute(tx)
}
