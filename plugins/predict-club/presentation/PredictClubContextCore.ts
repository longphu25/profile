import { createContext } from 'react'
import type { CreateRoundResult } from '../application/createRound'
import type { ConfirmRoundResult } from '../application/confirmRound'
import type { ClaimParams } from '../application/claimWinnings'
import type { CreateEscrowParams } from '../application/manageEscrow'
import type { SettlementOutcome } from '../application/settleRound'
import type { ConsensusResult } from '../domain/indicatorConsensus'
import type { CreateRoundParams } from '../domain/policies'
import type { RiskEvaluation } from '../domain/riskGate'
import type {
  AssetBalances,
  ClubMember,
  ClubState,
  EscrowOfferView,
  ModalKind,
  RoundStatus,
} from '../domain/types'
import type { PredictPricingSnapshot } from '../infrastructure/deepbookPredictPricingService'
import type { ClubOracleSnapshot } from '../infrastructure/deepbookOracleService'
import type { SuiHostAPI } from '../../../src/sui-dashboard/sui-types'

export interface PredictClubContextValue {
  club: ClubState
  context: { address: string | null; isConnected: boolean }
  balances: AssetBalances
  modal: ModalKind | null
  setModal: (m: ModalKind | null) => void
  selectedOffer: EscrowOfferView | null
  setSelectedOffer: (o: EscrowOfferView | null) => void
  primaryAction: { label: string; action: () => void }
  fundingRecommendation: { route: string; label: string; reason: string; blocked: boolean }
  updateRoundStatus: (status: RoundStatus) => void
  host: SuiHostAPI | null
  actions: PredictClubActions
  riskEvaluation: RiskEvaluation
  consensus: ConsensusResult
  toastMessage: string | null
  oracleSnapshot: ClubOracleSnapshot
  pricingSnapshot: PredictPricingSnapshot
  currentMember: ClubMember | null
  predictManagerId: string | null
  predictManagerLoading: boolean
}

export interface PredictClubActions {
  createRound: (params: CreateRoundParams) => CreateRoundResult
  createPredictManager: () => Promise<{ ok: boolean; digest?: string; error?: string }>
  confirmRound: () => ConfirmRoundResult
  pledgeToRound: (memberId: string, amount: number) => { ok: boolean; error?: string }
  publishRound: () => { ok: boolean; error?: string }
  executeRound: () => Promise<{ ok: boolean; error?: string }>
  settleRound: (outcome: SettlementOutcome) => { ok: boolean; error?: string }
  createEscrowOffer: (params: CreateEscrowParams) => { ok: boolean; error?: string }
  fillEscrowOffer: (offerId: string) => { ok: boolean; error?: string }
  cancelEscrowOffer: (offerId: string) => { ok: boolean; error?: string }
  createEscrowOfferOnChain: (params: {
    offerCoinId: string
    offerAsset: 'DUSDC' | 'USDC' | 'SUI'
    wantAsset: 'DUSDC' | 'USDC' | 'SUI'
    wantAmount: bigint
    expiresInEpochs: number
    recipient?: string
    roundId?: string
  }) => Promise<{ ok: boolean; digest?: string; error?: string }>
  fillEscrowOfferOnChain: (
    offer: EscrowOfferView,
    paymentCoinId: string,
  ) => Promise<{ ok: boolean; digest?: string; error?: string }>
  cancelEscrowOfferOnChain: (
    offer: EscrowOfferView,
  ) => Promise<{ ok: boolean; digest?: string; error?: string }>
  claimSettlementOnChain: (
    params: ClaimParams,
  ) => Promise<{ ok: boolean; digest?: string; error?: string }>
  swapSuiToUsdc: (
    suiAmount: number,
    minUsdcOut: number,
  ) => Promise<{ ok: boolean; digest?: string; error?: string }>
}

export const PredictClubContext = createContext<PredictClubContextValue | null>(null)
