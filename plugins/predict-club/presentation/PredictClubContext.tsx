import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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
import { executeTradeplan } from '../application/executeTradeplan'
import { createSuiPredictGateway } from '../infrastructure/suiPredictGateway'
import { fetchWalletBalances } from '../infrastructure/walletBalanceService'
import { transition } from '../domain/roundLifecycle'
import { evaluateRiskGate, type RiskEvaluation } from '../domain/riskGate'
import { computeConsensus, type ConsensusResult } from '../domain/indicatorConsensus'
import * as store from '../data/clubStore'
import {
  subscribeOracle,
  getSnapshot,
  type ClubOracleSnapshot,
} from '../infrastructure/deepbookOracleService'
import { deriveSignalsFromPrices } from '../infrastructure/indicatorSignalGateway'
import type {
  AssetBalances,
  ClubState,
  EscrowOfferView,
  ModalKind,
  RoundStatus,
} from '../domain/types'
import type { CreateRoundParams } from '../domain/policies'
import type { SuiHostAPI } from '../../../src/sui-dashboard/sui-types'

const ZERO_BALANCES: AssetBalances = { sui: 0, usdc: 0, dusdc: 0 }

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
  oracleSnapshot: ClubOracleSnapshot
}

export interface PredictClubActions {
  createRound: (params: CreateRoundParams) => CreateRoundResult
  confirmRound: () => ConfirmRoundResult
  pledgeToRound: (memberId: string, amount: number) => { ok: boolean; error?: string }
  publishRound: () => { ok: boolean; error?: string }
  executeRound: () => Promise<{ ok: boolean; error?: string }>
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

  // Subscribe to oracle stream
  const oracleSnapshot = useSyncExternalStore(subscribeOracle, getSnapshot)

  // Wallet balances — fetch on connect, poll every 30s
  const [balances, setBalances] = useState<AssetBalances>(ZERO_BALANCES)

  useEffect(() => {
    if (!host) return
    let intervalId: ReturnType<typeof setInterval> | null = null

    const fetchAndSet = (address: string) => {
      fetchWalletBalances(address)
        .then(setBalances)
        .catch(() => {})
    }

    const handleCtxChange = (ctx: { address: string | null; isConnected: boolean }) => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      if (ctx.isConnected && ctx.address) {
        fetchAndSet(ctx.address)
        intervalId = setInterval(() => fetchAndSet(ctx.address!), 30_000)
      } else {
        setBalances(ZERO_BALANCES)
      }
    }

    // Initial check
    handleCtxChange(host.getSuiContext())
    const unsub = host.onSuiContextChange(handleCtxChange)

    return () => {
      unsub()
      if (intervalId) clearInterval(intervalId)
    }
  }, [host])

  // Real-time: update btcSpot, indicators, and auto-detect settlement
  useEffect(() => {
    return subscribeOracle((snap) => {
      const spot = snap.oracleState?.latest_price?.spot
      if (spot && spot > 0) {
        // Update live BTC spot in active round
        store.updateClub((c) => ({
          ...c,
          activeRound: { ...c.activeRound, btcSpot: spot },
        }))
      }

      // Derive live indicators from price history
      if (snap.prices.length >= 3) {
        const liveSignals = deriveSignalsFromPrices(snap.prices)
        store.updateClub((c) => ({
          ...c,
          activeRound: { ...c.activeRound, indicators: liveSignals },
        }))
      }

      // Auto-settle when oracle status becomes 'settled'
      const currentClub = store.getStoreState().club
      if (
        snap.oracleState?.status === 'settled' &&
        snap.oracleState.settlement_price !== null &&
        currentClub.activeRound.status === 'executed'
      ) {
        const settledPrice = snap.oracleState.settlement_price
        const { direction, strike, lowerStrike, upperStrike } = currentClub.activeRound
        let result: 'won' | 'lost' | 'void' = 'void'
        if (direction === 'UP') result = settledPrice > strike ? 'won' : 'lost'
        else if (direction === 'DOWN') result = settledPrice < strike ? 'won' : 'lost'
        else if (direction === 'RANGE')
          result =
            settledPrice >= (lowerStrike ?? 0) && settledPrice <= (upperStrike ?? Infinity)
              ? 'won'
              : 'lost'

        const outcome: SettlementOutcome = {
          roundId: currentClub.activeRound.id,
          result,
          settledPrice,
          settledAt: Date.now(),
        }
        const settled = settleRound(currentClub, outcome)
        if (settled.ok && settled.club) {
          store.setClub(settled.club)
          store.setToast(`Oracle settled: ${result} @ ${settledPrice.toFixed(0)}`)
        }
      }
    })
  }, [])

  const round = club.activeRound
  const funding = useMemo(() => recommendFundingRoute(balances, round), [balances, round])

  const riskEvaluation = useMemo(
    () =>
      evaluateRiskGate({
        oracleLastUpdate: oracleSnapshot.lastUpdateMs || Date.now() - 15000,
        oracleStaleThresholdMs: 60000,
        expiryMinutes: round.expiryMinutes,
        minSafeExpiryMinutes: 5,
        memberDusdc: balances.dusdc,
        suggestedDusdc: round.suggestedDusdc,
        signalBias: round.signalBias,
        indicators: round.indicators,
      }),
    [balances, round, oracleSnapshot.lastUpdateMs],
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
          oracleLastUpdate: oracleSnapshot.lastUpdateMs || Date.now() - 15000,
          oracleStaleThresholdMs: 60000,
          expiryMinutes: round.expiryMinutes,
          minSafeExpiryMinutes: 5,
          memberDusdc: balances.dusdc,
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
          walletBalance: balances.dusdc,
        })
        if (result.ok && result.club) {
          store.setClub(result.club)
          store.setToast(`Pledged ${amount} DUSDC`)
        }
        return { ok: result.ok, error: result.error }
      },

      executeRound: async () => {
        const address = host?.getSuiContext().address
        if (!address) return { ok: false, error: 'Wallet not connected' }

        const oracle = oracleSnapshot.oracleState
        const selectedOracleId = oracleSnapshot.selectedOracleId
        if (!selectedOracleId || !oracle) {
          return { ok: false, error: 'No active oracle available' }
        }

        // Find manager ID for this wallet
        const gateway = createSuiPredictGateway()
        const managerId = await gateway.fetchManagerId(address)
        if (!managerId) {
          return { ok: false, error: 'No predict manager found — create one first' }
        }

        // Find member ID from wallet address
        const member =
          club.members.find((m) =>
            m.wallet.toLowerCase().includes(address.slice(-3).toLowerCase()),
          ) ?? club.members[0]

        // Fetch oracle entry for tickSize/minStrike
        const oracleEntry = oracleSnapshot.oracles.find((o) => o.oracle_id === selectedOracleId)

        const result = await executeTradeplan(
          club,
          member.id,
          {
            direction: round.direction,
            strike: round.strike,
            lowerStrike: round.lowerStrike,
            upperStrike: round.upperStrike,
            amountDusdc: round.suggestedDusdc,
            oracleId: selectedOracleId,
            expiryMs: oracleEntry?.expiry ?? round.expiryMinutes * 60_000 + Date.now(),
            expiryMinutes: round.expiryMinutes,
            managerId,
            walletAddress: address,
            tickSize: (oracleEntry as any)?.tick_size ?? 1_000_000_000,
            minStrike: (oracleEntry as any)?.min_strike ?? 50_000_000_000_000,
          },
          gateway,
          async (tx) => {
            const txResult = await host!.signAndExecuteTransaction(tx)
            return { digest: (txResult as any).digest ?? '' }
          },
        )

        if (result.ok && result.club) {
          store.setClub(result.club)
          store.updateClub((c) => ({
            ...c,
            activeRound: { ...c.activeRound, status: 'executed' },
          }))
          store.setToast(`Trade executed — ${result.digest?.slice(0, 12)}…`)
          store.setModal(null)
        } else {
          store.setToast(result.error ?? 'Execution failed')
        }
        return { ok: result.ok, error: result.error }
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
    [balances, club, round, oracleSnapshot.lastUpdateMs],
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
    balances: balances,
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
    oracleSnapshot,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
