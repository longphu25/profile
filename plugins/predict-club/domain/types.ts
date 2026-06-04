import type { SuiContext } from '../../../src/sui-dashboard/sui-types'

export type Direction = 'UP' | 'DOWN' | 'RANGE'
export type RoundStatus =
  | 'draft'
  | 'open'
  | 'confirmed'
  | 'funding'
  | 'executed'
  | 'settled'
  | 'claimed'
  | 'cancelled'

export type MemberRoundState = 'watching' | 'pledged' | 'accepted' | 'executed' | 'claimed'
export type SignalBias = 'bullish' | 'bearish' | 'neutral' | 'no-trade'
export type IndicatorState = 'bullish' | 'bearish' | 'neutral' | 'blocked'
export type RiskState = 'ready' | 'warning' | 'blocked'
export type ModalKind =
  | 'create-round'
  | 'fund-to-join'
  | 'create-escrow'
  | 'fill-escrow'
  | 'scallop-borrow'
  | 'execute-trade'
  | 'claim-settlement'

export type FundingRoute =
  | 'ready-with-dusdc'
  | 'deepbook-sui-to-usdc'
  | 'scallop-borrow-usdc'
  | 'bridge-assets-to-sui'
  | 'club-escrow-usdc-to-dusdc'

export type EscrowStatus = 'open' | 'reserved' | 'filled' | 'expired' | 'cancelled'

export interface AssetBalances {
  sui: number
  usdc: number
  dusdc: number
}

export interface ClubMember {
  id: string
  name: string
  wallet: string
  role: 'leader' | 'member'
  state: MemberRoundState
  pledgedDusdc: number
  accepted: boolean
}

export interface IndicatorSignal {
  id: string
  name: string
  state: IndicatorState
  value: string
  confidence: number
}

export interface PredictionRound {
  id: string
  market: string
  btcSpot: number
  direction: Direction
  strike: number
  lowerStrike?: number
  upperStrike?: number
  expiryLabel: string
  expiryMinutes: number
  totalPledgedDusdc: number
  fundingDusdc: number
  fundingTargetDusdc: number
  risk: RiskState
  status: RoundStatus
  thesis: string
  oracle: string
  suggestedDusdc: number
  signalBias: SignalBias
  confidence: 'Low' | 'Medium' | 'High'
  indicators: IndicatorSignal[]
}

export interface FundingCard {
  route: FundingRoute
  title: string
  description: string
  status: 'ready' | 'available' | 'needs-review' | 'blocked'
  action: string
}

export interface EscrowOfferView {
  id: string
  maker: string
  offerAsset: 'DUSDC' | 'USDC'
  wantAsset: 'DUSDC' | 'USDC'
  offerAmount: number
  wantAmount: number
  expiry: string
  roundId?: string
  status: EscrowStatus
}

export interface HistoryRow {
  id: string
  direction: Direction
  strike: string
  result: 'won' | 'lost' | 'void'
  pnlDusdc: number
  thesis: string
  participants: number
  claimStatus: 'claimed' | 'claimable' | 'none'
}

export interface ClaimItem {
  id: string
  roundId: string
  amountDusdc: number
  status: 'ready' | 'waiting'
}

export interface ClubState {
  name: string
  leaderName: string
  activeRound: PredictionRound
  members: ClubMember[]
  fundingCards: FundingCard[]
  escrowOffers: EscrowOfferView[]
  history: HistoryRow[]
  claims: ClaimItem[]
}

export interface WalletSnapshot {
  context: SuiContext
  balances: AssetBalances
}
