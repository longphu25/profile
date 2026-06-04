import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { recommendFundingRoute } from '../application/recommendFundingRoute'
import { createRound, type CreateRoundResult } from '../application/createRound'
import { confirmRound, type ConfirmRoundResult } from '../application/confirmRound'
import { pledgeToRound } from '../application/pledgeToRound'
import {
  createEscrowOffer,
  fillEscrowOffer,
  cancelEscrowOffer,
  type CreateEscrowParams,
} from '../application/manageEscrow'
import { settleRound, type SettlementOutcome } from '../application/settleRound'
import { transition } from '../domain/roundLifecycle'
import { evaluateRiskGate, type RiskEvaluation } from '../domain/riskGate'
import { computeConsensus, type ConsensusResult } from '../domain/indicatorConsensus'
import * as store from '../data/clubStore'
import type {
  AssetBalances,
  ClubState,
  EscrowOfferView,
  ModalKind,
  RoundStatus,
} from '../domain/types'
import type { CreateRoundParams } from '../domain/policies'
import type { SuiHostAPI } from '../../../src/sui-dashboard/sui-types'

const demoBalances: AssetBalances = { sui: 1240.5, usdc: 5000, dusdc: 2500 }

export interface PredictClubContextValue {
  club: ClubState
  context: { address: string | null; isConnected: boolean }
  balances: AssetBalances
  modal: ModalKind | null
  setModal: (m: ModalKind | null) => void
  selectedOffer: EscrowOfferView | null
  setSelectedOffer: (o: EscrowOfferView | null) => void
  primaryAction: { label: string; action: () => void }
  fundingRecommendation: { route: string; label: string }
  updateRoundStatus: (status: RoundStatus) => void
  host: SuiHostAPI | null
  actions: PredictClubActions
  riskEvaluation: RiskEvaluation
  consensus: ConsensusResult
  toastMessage: string | null
}

export interface PredictClubActions {
  createRound: (params: CreateRoundParams) => CreateRoundResult
  confirmRound: () => ConfirmRoundResult
  pledgeToRound: (memberId: string, amount: number) => { ok: boolean; error?: string }
  publishRound: () => { ok: boolean; error?: string }
  executeRound: () => { ok: boolean; error?: string }
  settleRound: (outcome: SettlementOutcome) => { ok: boolean; error?: string }
  createEscrowOffer: (params: CreateEscrowParams) => { ok: boolean; error?: string }
  fillEscrowOffer: (offerId: string) => { ok: boolean; error?: string }
  cancelEscrowOffer: (offerId: string) => { ok: boolean; error?: string }
}

const Ctx = createContext<PredictClubContextValue | null>(null)

export function usePredictClub(): PredictClubContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePredictClub must be inside PredictClubProvider')
  return v
}

export function PredictClubProvider({
  host,
  children,
}: {
  host: SuiHostAPI | null
  children: ReactNode
}) {
  // Subscribe to shared global store
  const storeState = useSyncExternalStore(store.subscribe, store.getStoreState)
  const club = storeState.club
  const modal = storeState.modal
  const selectedOffer = storeState.selectedOffer
  const toastMessage = storeState.toastMessage

  const round = club.activeRound
  const funding = useMemo(() => recommendFundingRoute(demoBalances, round), [round])

  const riskEvaluation = useMemo(
    () =>
      evaluateRiskGate({
        oracleLastUpdate: Date.now() - 15000,
        oracleStaleThresholdMs: 60000,
        expiryMinutes: round.expiryMinutes,
        minSafeExpiryMinutes: 5,
        memberDusdc: demoBalances.dusdc,
        suggestedDusdc: round.suggestedDusdc,
        signalBias: round.signalBias,
        indicators: round.indicators,
      }),
    [round],
  )

  const consensus = useMemo(() => computeConsensus(round.indicators), [round.indicators])

  const updateRoundStatus = useCallback((status: RoundStatus) => {
    store.updateClub((c) => ({ ...c, activeRound: { ...c.activeRound, status } }))
  }, [])

  // ─── Use Case Actions ───
  const actions: PredictClubActions = useMemo(
    () => ({
      createRound: (params: CreateRoundParams) => {
        const result = createRound(club, params)
        if (result.ok && result.club) {
          store.setClub(result.club)
          store.setToast('Round created')
          store.setModal(null)
        }
        return result
      },

      confirmRound: () => {
        const result = confirmRound(club, {
          oracleLastUpdate: Date.now() - 15000,
          oracleStaleThresholdMs: 60000,
          expiryMinutes: round.expiryMinutes,
          minSafeExpiryMinutes: 5,
          memberDusdc: demoBalances.dusdc,
          suggestedDusdc: round.suggestedDusdc,
          signalBias: round.signalBias,
          indicators: round.indicators,
        })
        if (result.ok && result.club) {
          store.setClub(result.club)
          store.setToast('Round confirmed')
        } else if (result.error) {
          store.setToast(result.error)
        }
        return result
      },

      publishRound: () => {
        const result = transition(club.activeRound.status, 'publish')
        if (result.ok && result.newStatus) {
          store.updateClub((c) => ({
            ...c,
            activeRound: { ...c.activeRound, status: result.newStatus! },
          }))
          store.setToast('Round published')
          store.setModal(null)
          return { ok: true }
        }
        return { ok: false, error: result.error }
      },

      pledgeToRound: (memberId: string, amount: number) => {
        const result = pledgeToRound(club, {
          memberId,
          amountDusdc: amount,
          walletBalance: demoBalances.dusdc,
        })
        if (result.ok && result.club) {
          store.setClub(result.club)
          store.setToast(`Pledged ${amount} DUSDC`)
        }
        return { ok: result.ok, error: result.error }
      },

      executeRound: () => {
        // Support from confirmed or funding
        if (club.activeRound.status === 'confirmed' || club.activeRound.status === 'funding') {
          store.updateClub((c) => ({
            ...c,
            activeRound: { ...c.activeRound, status: 'executed' },
            members: c.members.map((m) =>
              m.state === 'accepted' || m.state === 'pledged'
                ? { ...m, state: 'executed' as const }
                : m,
            ),
          }))
          store.setToast('Trade executed (simulated)')
          store.setModal(null)
          return { ok: true }
        }
        const result = transition(club.activeRound.status, 'execute')
        if (result.ok && result.newStatus) {
          store.updateClub((c) => ({
            ...c,
            activeRound: { ...c.activeRound, status: result.newStatus! },
            members: c.members.map((m) =>
              m.state === 'accepted' || m.state === 'pledged'
                ? { ...m, state: 'executed' as const }
                : m,
            ),
          }))
          store.setToast('Trade executed (simulated)')
          store.setModal(null)
          return { ok: true }
        }
        return { ok: false, error: result.error }
      },

      settleRound: (outcome: SettlementOutcome) => {
        const result = settleRound(club, outcome)
        if (result.ok && result.club) {
          store.setClub(result.club)
          store.setToast(`Round settled: ${outcome.result}`)
        }
        return { ok: result.ok, error: result.error }
      },

      createEscrowOffer: (params: CreateEscrowParams) => {
        const result = createEscrowOffer(club, params)
        if (result.ok && result.club) {
          store.setClub(result.club)
          store.setToast('Escrow offer created')
          store.setModal(null)
        }
        return { ok: result.ok, error: result.error }
      },

      fillEscrowOffer: (offerId: string) => {
        const result = fillEscrowOffer(club, offerId)
        if (result.ok && result.club) {
          store.setClub(result.club)
          store.setToast('Escrow filled')
          store.setModal(null)
        }
        return { ok: result.ok, error: result.error }
      },

      cancelEscrowOffer: (offerId: string) => {
        const result = cancelEscrowOffer(club, offerId)
        if (result.ok && result.club) {
          store.setClub(result.club)
          store.setToast('Escrow cancelled')
        }
        return { ok: result.ok, error: result.error }
      },
    }),
    [club, round],
  )

  // ─── Primary Action ───
  const primaryAction = useMemo(() => {
    switch (round.status) {
      case 'draft':
        return { label: 'Publish Round', action: () => actions.publishRound() }
      case 'open':
        return { label: 'Confirm Round', action: () => actions.confirmRound() }
      case 'confirmed':
      case 'funding':
        return { label: 'Execute Trade', action: () => store.setModal('execute-trade') }
      case 'executed':
        return {
          label: 'Settle (Demo)',
          action: () =>
            actions.settleRound({
              roundId: round.id,
              result: 'won',
              settledPrice: round.strike + 100,
              settledAt: Date.now(),
            }),
        }
      case 'settled':
        return { label: 'Claim Settlement', action: () => store.setModal('claim-settlement') }
      case 'claimed':
        return { label: 'New Round', action: () => store.setModal('create-round') }
      default:
        return { label: 'Accept Signal', action: () => updateRoundStatus('funding') }
    }
  }, [round.status, round.id, round.strike, actions, updateRoundStatus])

  const value: PredictClubContextValue = {
    club,
    context: { address: null, isConnected: false },
    balances: demoBalances,
    modal,
    setModal: store.setModal,
    selectedOffer,
    setSelectedOffer: store.setSelectedOffer,
    primaryAction,
    fundingRecommendation: { route: funding.route, label: funding.label },
    updateRoundStatus,
    host,
    actions,
    riskEvaluation,
    consensus,
    toastMessage,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
