import type { ClubState, EscrowOfferView } from '../domain/types'

export interface CreateEscrowParams {
  offerAsset: 'DUSDC' | 'USDC'
  wantAsset: 'DUSDC' | 'USDC'
  offerAmount: number
  wantAmount: number
  expiryMinutes: number
  roundId?: string
  maker: string
}

// Start counter well above fixture max (9183) and use timestamp to avoid
// collisions with persisted localStorage state across sessions.
let escrowCounter = 9200 + Math.floor((Date.now() % 100000) / 10)

export function createEscrowOffer(
  club: ClubState,
  params: CreateEscrowParams,
): { ok: boolean; club?: ClubState; error?: string } {
  if (params.offerAmount <= 0 || params.wantAmount <= 0) {
    return { ok: false, error: 'Amounts must be positive' }
  }

  escrowCounter++
  const offer: EscrowOfferView = {
    id: `ESC-${escrowCounter}`,
    maker: params.maker,
    offerAsset: params.offerAsset,
    wantAsset: params.wantAsset,
    offerAmount: params.offerAmount,
    wantAmount: params.wantAmount,
    expiry: `${params.expiryMinutes}m`,
    roundId: params.roundId,
    status: 'open',
  }

  return {
    ok: true,
    club: { ...club, escrowOffers: [...club.escrowOffers, offer] },
  }
}

export function fillEscrowOffer(
  club: ClubState,
  offerId: string,
): { ok: boolean; club?: ClubState; error?: string } {
  const offer = club.escrowOffers.find((o) => o.id === offerId)
  if (!offer) return { ok: false, error: 'Offer not found' }
  if (offer.status !== 'open') return { ok: false, error: `Offer is ${offer.status}` }

  const updatedOffers = club.escrowOffers.map((o) =>
    o.id === offerId ? { ...o, status: 'filled' as const } : o,
  )

  return { ok: true, club: { ...club, escrowOffers: updatedOffers } }
}

export function cancelEscrowOffer(
  club: ClubState,
  offerId: string,
): { ok: boolean; club?: ClubState; error?: string } {
  const offer = club.escrowOffers.find((o) => o.id === offerId)
  if (!offer) return { ok: false, error: 'Offer not found' }
  if (offer.status !== 'open') return { ok: false, error: `Cannot cancel: ${offer.status}` }

  const updatedOffers = club.escrowOffers.filter((o) => o.id !== offerId)
  return { ok: true, club: { ...club, escrowOffers: updatedOffers } }
}
