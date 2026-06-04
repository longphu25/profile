import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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
import { loadClubState, saveClubState } from '../data/localClubStore'
import type {
  AssetBalances,
  ClubState,
  EscrowOfferView,
  ModalKind,
  RoundStatus,
} from '../domain/types'
import type { CreateRoundParams } from '../domain/policies'
import type { SuiContext, SuiHostAPI } from '../../../src/sui-dashboard/sui-types'

const demoBalances: AssetBalances = { sui: 1240.5, usdc: 5000, dusdc: 2500 }

const defaultContext: SuiContext = {
  address: null,
  network: 'testnet',
  isConnected: false,
  accounts: [],
}

export interface PredictClubContextValue {
  club: ClubState
  setClub: React.Dispatch<React.SetStateAction<ClubState>>
  context: SuiContext
  balances: AssetBalances
  modal: ModalKind | null
  setModal: (m: ModalKind | null) => void
  selectedOffer: EscrowOfferView | null
  setSelectedOffer: (o: EscrowOfferView | null) => void
  primaryAction: { label: string; action: () => void }
  fundingRecommendation: { route: string; label: string }
  updateRoundStatus: (status: RoundStatus) => void
  host: SuiHostAPI | null
  // Use case actions
  actions: PredictClubActions
  // Computed domain state
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
  const [club, setClub] = useState<ClubState>(() => loadClubState())
  const [modal, setModal] = useState<ModalKind | null>(null)
  const [selectedOffer, setSelectedOffer] = useState<EscrowOfferView | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [context, setContext] = useState<SuiContext>(() => host?.getSuiContext() ?? defaultContext)

  useEffect(() => {
    if (!host) return undefined
    setContext(host.getSuiContext())
    return host.onSuiContextChange(setContext)
  }, [host])

  useEffect(() => {
    saveClubState(club)
  }, [club])

  // Auto-clear toast
  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToastMessage(null), 3000)
    return () => clearTimeout(t)
  }, [toastMessage])

  const round = club.activeRound
  const funding = useMemo(() => recommendFundingRoute(demoBalances, round), [round])

  const riskEvaluation = useMemo(
    () =>
      evaluateRiskGate({
        oracleLastUpdate: Date.now() - 15000, // 15s ago (simulated healthy)
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

  const isLeader = context.address ? context.address.toLowerCase().endsWith('7c') : true // Demo: treat as leader when no wallet

  function updateRoundStatus(status: RoundStatus) {
    setClub((current) => ({
      ...current,
      activeRound: { ...current.activeRound, status },
    }))
  }

  // ─── Use Case Actions ───

  const actions: PredictClubActions = {
    createRound: useCallback(
      (params: CreateRoundParams) => {
        const result = createRound(club, params)
        if (result.ok && result.club) {
          setClub(result.club)
          setToastMessage('Round created successfully')
          setModal(null)
        }
        return result
      },
      [club],
    ),

    confirmRound: useCallback(() => {
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
        setClub(result.club)
        setToastMessage('Round confirmed by leader')
      } else if (result.error) {
        setToastMessage(result.error)
      }
      return result
    }, [club, round]),

    publishRound: useCallback(() => {
      const result = transition(club.activeRound.status, 'publish')
      if (result.ok && result.newStatus) {
        setClub((c) => ({ ...c, activeRound: { ...c.activeRound, status: result.newStatus! } }))
        setToastMessage('Round published - members can now pledge')
        setModal(null)
        return { ok: true }
      }
      return { ok: false, error: result.error }
    }, [club]),

    pledgeToRound: useCallback(
      (memberId: string, amount: number) => {
        const result = pledgeToRound(club, {
          memberId,
          amountDusdc: amount,
          walletBalance: demoBalances.dusdc,
        })
        if (result.ok && result.club) {
          setClub(result.club)
          setToastMessage(`Pledged ${amount} DUSDC`)
        }
        return { ok: result.ok, error: result.error }
      },
      [club],
    ),

    executeRound: useCallback(() => {
      // Simulate execution: transition funding → executed
      const result = transition(club.activeRound.status, 'execute')
      if (result.ok && result.newStatus) {
        const updatedMembers = club.members.map((m) =>
          m.state === 'accepted' || m.state === 'pledged'
            ? { ...m, state: 'executed' as const }
            : m,
        )
        setClub((c) => ({
          ...c,
          activeRound: { ...c.activeRound, status: result.newStatus! },
          members: updatedMembers,
        }))
        setToastMessage('Trade executed successfully (simulated)')
        setModal(null)
        return { ok: true }
      }
      // Also support from confirmed → funding → executed in one click for demo
      if (club.activeRound.status === 'confirmed') {
        setClub((c) => ({
          ...c,
          activeRound: { ...c.activeRound, status: 'executed' },
          members: c.members.map((m) =>
            m.state === 'accepted' || m.state === 'pledged'
              ? { ...m, state: 'executed' as const }
              : m,
          ),
        }))
        setToastMessage('Trade executed (simulated)')
        setModal(null)
        return { ok: true }
      }
      return { ok: false, error: result.error }
    }, [club]),

    settleRound: useCallback(
      (outcome: SettlementOutcome) => {
        const result = settleRound(club, outcome)
        if (result.ok && result.club) {
          setClub(result.club)
          setToastMessage(`Round settled: ${outcome.result}`)
        }
        return { ok: result.ok, error: result.error }
      },
      [club],
    ),

    createEscrowOffer: useCallback(
      (params: CreateEscrowParams) => {
        const result = createEscrowOffer(club, params)
        if (result.ok && result.club) {
          setClub(result.club)
          setToastMessage('Escrow offer created')
          setModal(null)
        }
        return { ok: result.ok, error: result.error }
      },
      [club],
    ),

    fillEscrowOffer: useCallback(
      (offerId: string) => {
        const result = fillEscrowOffer(club, offerId)
        if (result.ok && result.club) {
          setClub(result.club)
          setToastMessage('Escrow offer filled')
          setModal(null)
        }
        return { ok: result.ok, error: result.error }
      },
      [club],
    ),

    cancelEscrowOffer: useCallback(
      (offerId: string) => {
        const result = cancelEscrowOffer(club, offerId)
        if (result.ok && result.club) {
          setClub(result.club)
          setToastMessage('Escrow offer cancelled')
        }
        return { ok: result.ok, error: result.error }
      },
      [club],
    ),
  }

  // ─── Primary Action Logic ───

  const primaryAction = useMemo(() => {
    if (!context.isConnected && context.address === null) {
      // Demo mode: show contextual action based on round status
    }

    switch (round.status) {
      case 'draft':
        return { label: 'Publish Round', action: () => actions.publishRound() }
      case 'open':
        if (isLeader) return { label: 'Confirm Round', action: () => actions.confirmRound() }
        return { label: 'Pledge to Join', action: () => setModal('fund-to-join') }
      case 'confirmed':
      case 'funding':
        return { label: 'Execute Trade', action: () => setModal('execute-trade') }
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
        return { label: 'Claim Settlement', action: () => setModal('claim-settlement') }
      case 'claimed':
        return { label: 'New Round', action: () => setModal('create-round') }
      default:
        return { label: 'Accept Signal', action: () => updateRoundStatus('funding') }
    }
  }, [round.status, isLeader, context.isConnected, actions])

  const value: PredictClubContextValue = {
    club,
    setClub,
    context,
    balances: demoBalances,
    modal,
    setModal,
    selectedOffer,
    setSelectedOffer,
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
