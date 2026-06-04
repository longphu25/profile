import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { recommendFundingRoute } from '../application/recommendFundingRoute'
import { loadClubState, saveClubState } from '../data/localClubStore'
import type {
  AssetBalances,
  ClubState,
  EscrowOfferView,
  ModalKind,
  RoundStatus,
} from '../domain/types'
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
  const [context, setContext] = useState<SuiContext>(() => host?.getSuiContext() ?? defaultContext)

  useEffect(() => {
    if (!host) return undefined
    setContext(host.getSuiContext())
    return host.onSuiContextChange(setContext)
  }, [host])

  useEffect(() => {
    saveClubState(club)
  }, [club])

  const round = club.activeRound
  const funding = useMemo(() => recommendFundingRoute(demoBalances, round), [round])
  const isLeader = context.address ? context.address.toLowerCase().endsWith('7c') : false

  function updateRoundStatus(status: RoundStatus) {
    setClub((current) => ({
      ...current,
      activeRound: { ...current.activeRound, status },
    }))
  }

  const primaryAction = useMemo(() => {
    if (!context.isConnected)
      return { label: 'Connect Wallet', action: () => host?.requestConnect() }
    if (round.status === 'settled')
      return { label: 'Claim Settlement', action: () => setModal('claim-settlement') }
    if (round.status === 'confirmed' || round.status === 'funding') {
      if (demoBalances.dusdc < round.suggestedDusdc) {
        return { label: 'Fund to Join', action: () => setModal('fund-to-join') }
      }
      return { label: 'Execute Trade', action: () => setModal('execute-trade') }
    }
    if (isLeader) return { label: 'Leader Confirm', action: () => updateRoundStatus('confirmed') }
    return { label: 'Accept Signal', action: () => updateRoundStatus('funding') }
  }, [context.isConnected, host, isLeader, round.status, round.suggestedDusdc])

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
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
