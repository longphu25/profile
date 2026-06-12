import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { recommendFundingRoute } from '../application/recommendFundingRoute'
import { createRound } from '../application/createRound'
import { confirmRound } from '../application/confirmRound'
import { pledgeToRound } from '../application/pledgeToRound'
import {
  createEscrowOffer,
  fillEscrowOffer,
  cancelEscrowOffer,
  type CreateEscrowParams,
} from '../application/manageEscrow'
import {
  createOfferOnChain,
  fillOfferOnChain,
  cancelOfferOnChain,
} from '../application/escrowOnChain'
import { claimWinnings } from '../application/claimWinnings'
import { swapSuiToUsdc } from '../application/swapSuiToUsdc'
import { fetchOnChainOffers, invalidateEscrowCache } from '../infrastructure/escrowQueryService'

/** Merge local + on-chain escrow offers, de-duplicating by id (last write wins). */
function mergeEscrowOffers<T extends { id: string }>(localOnly: T[], incoming: T[]): T[] {
  const byId = new Map<string, T>()
  for (const offer of [...localOnly, ...incoming]) byId.set(offer.id, offer)
  return Array.from(byId.values())
}
import { settleRound, type SettlementOutcome } from '../application/settleRound'
import { executeTradeplan } from '../application/executeTradeplan'
import { createSuiPredictGateway } from '../infrastructure/suiPredictGateway'
import { fetchWalletBalances } from '../infrastructure/walletBalanceService'
import { transition } from '../domain/roundLifecycle'
import { evaluateRiskGate, type RiskGateInput } from '../domain/riskGate'
import { computeConsensus } from '../domain/indicatorConsensus'
import { MIN_SAFE_EXPIRY_MINUTES, ORACLE_STALE_THRESHOLD_MS } from '../domain/policies'
import * as store from '../data/clubStore'
import { subscribeOracle, getSnapshot } from '../infrastructure/deepbookOracleService'
import {
  EMPTY_CONTRACT_QUOTE,
  computeFairValuePreview,
  fetchPredictPricingSnapshot,
  type PredictPricingSnapshot,
} from '../infrastructure/deepbookPredictPricingService'
import { deriveSignalsFromPrices } from '../infrastructure/indicatorSignalGateway'
import type { AssetBalances, ClubMember, ClubState, RoundStatus } from '../domain/types'
import type { CreateRoundParams } from '../domain/policies'
import type { SuiHostAPI } from '../../../src/sui-dashboard/sui-types'
import {
  PREDICT_CLUB_WALLET_PROFILE_KEY,
  type PredictClubWalletProfile,
} from '../../sui-wallet-profile/types'
import {
  PredictClubContext,
  type PredictClubActions,
  type PredictClubContextValue,
} from './PredictClubContextCore'

const ZERO_BALANCES: AssetBalances = { sui: 0, usdc: 0, dusdc: 0 }

// Re-anchor the round strike toward live spot when it drifts beyond this fraction
// (5%), so the contract quote stays within pricing bounds.
const STRIKE_REANCHOR_THRESHOLD = 0.05

function createPricingSnapshot(round: ClubState['activeRound']): PredictPricingSnapshot {
  return {
    fairValue: computeFairValuePreview(round, null),
    quote: EMPTY_CONTRACT_QUOTE,
    manager: null,
    managerReason: 'Connect wallet to resolve PredictManager',
    vault: null,
    vaultReason: 'Vault liquidity unavailable',
    loading: false,
    updatedAt: 0,
  }
}

function preserveLastGoodPricingSnapshot(
  previous: PredictPricingSnapshot,
  next: PredictPricingSnapshot,
): PredictPricingSnapshot {
  return {
    ...next,
    manager: next.manager ?? previous.manager,
    managerReason:
      next.manager || !previous.manager
        ? next.managerReason
        : next.managerReason
          ? `${next.managerReason}; showing last known manager snapshot`
          : 'Showing last known manager snapshot',
    vault: next.vault ?? previous.vault,
    vaultReason:
      next.vault || !previous.vault
        ? next.vaultReason
        : next.vaultReason
          ? `${next.vaultReason}; showing last known vault snapshot`
          : 'Showing last known vault snapshot',
  }
}

function memberIdForWallet(address: string): string {
  return `member-${address.slice(2, 10).toLowerCase()}`
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

  // Track wallet context
  const [suiContext, setSuiContext] = useState(
    () => host?.getSuiContext() ?? { address: null as string | null, isConnected: false },
  )
  const [predictManagerId, setPredictManagerId] = useState<string | null>(null)
  const [predictManagerLoading, setPredictManagerLoading] = useState(false)
  const [pricingSnapshot, setPricingSnapshot] = useState<PredictPricingSnapshot>(() =>
    createPricingSnapshot(club.activeRound),
  )
  useEffect(() => {
    if (!host) return
    setSuiContext(host.getSuiContext())
    return host.onSuiContextChange(setSuiContext)
  }, [host])

  useEffect(() => {
    const address = suiContext.address
    if (!suiContext.isConnected || !address) return
    const exactMember = store
      .getStoreState()
      .club.members.find((member) => member.wallet.toLowerCase() === address.toLowerCase())
    if (exactMember) return

    const member: ClubMember = {
      id: memberIdForWallet(address),
      name: 'You',
      wallet: address,
      role: 'member',
      state: 'watching',
      pledgedDusdc: 0,
      accepted: false,
    }
    store.updateClub((current) => ({ ...current, members: [...current.members, member] }))
  }, [suiContext.address, suiContext.isConnected])

  useEffect(() => {
    const address = suiContext.address
    if (!suiContext.isConnected || !address) {
      setPredictManagerId(null)
      setPredictManagerLoading(false)
      return
    }

    let cancelled = false
    setPredictManagerLoading(true)
    createSuiPredictGateway()
      .fetchManagerId(address)
      .then((managerId) => {
        if (!cancelled) setPredictManagerId(managerId)
      })
      .catch(() => {
        if (!cancelled) setPredictManagerId(null)
      })
      .finally(() => {
        if (!cancelled) setPredictManagerLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [suiContext.address, suiContext.isConnected])

  // Subscribe to oracle stream
  const oracleSnapshot = useSyncExternalStore(subscribeOracle, getSnapshot)

  useEffect(() => {
    const address = suiContext.isConnected ? suiContext.address : null
    let cancelled = false

    setPricingSnapshot((current) => ({
      ...current,
      fairValue: computeFairValuePreview(club.activeRound, oracleSnapshot.oracleState),
      loading: true,
    }))

    fetchPredictPricingSnapshot({
      walletAddress: address,
      managerId: predictManagerId,
      oracle: oracleSnapshot.oracleState,
      round: club.activeRound,
    })
      .then((snapshot) => {
        if (!cancelled) {
          setPricingSnapshot((current) => preserveLastGoodPricingSnapshot(current, snapshot))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPricingSnapshot((current) => ({
            fairValue: computeFairValuePreview(club.activeRound, oracleSnapshot.oracleState),
            quote: { ...EMPTY_CONTRACT_QUOTE, reason: 'Contract quote unavailable' },
            manager: current.manager,
            managerReason: current.manager
              ? 'PredictManager unavailable; showing last known manager snapshot'
              : 'PredictManager unavailable',
            vault: current.vault,
            vaultReason: current.vault
              ? 'Vault liquidity unavailable; showing last known vault snapshot'
              : 'Vault liquidity unavailable',
            loading: false,
            updatedAt: Date.now(),
          }))
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    club.activeRound.direction,
    club.activeRound.expiryMinutes,
    club.activeRound.lowerStrike,
    club.activeRound.strike,
    club.activeRound.suggestedDusdc,
    club.activeRound.upperStrike,
    oracleSnapshot.oracleState,
    predictManagerId,
    suiContext.address,
    suiContext.isConnected,
  ])

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
        // Load on-chain offers
        fetchOnChainOffers()
          .then((offers) => {
            if (offers.length > 0) {
              store.updateClub((c) => {
                const localOnly = c.escrowOffers.filter((o) => !o.id.startsWith('0x'))
                return { ...c, escrowOffers: mergeEscrowOffers(localOnly, offers) }
              })
            }
          })
          .catch(() => {})
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
        // Update live BTC spot, and re-anchor a far-off strike toward spot so the
        // contract quote stays computable (avoids "strike outside pricing bounds").
        store.updateClub((c) => {
          const round = c.activeRound
          const editable =
            round.status === 'draft' || round.status === 'open' || round.status === 'confirmed'
          const farFromSpot =
            round.strike > 0 && Math.abs(round.strike - spot) / spot > STRIKE_REANCHOR_THRESHOLD
          let nextRound = { ...round, btcSpot: spot }
          if (editable && round.direction !== 'RANGE' && farFromSpot) {
            // Snap strike to spot plus a small directional offset (0.25%).
            const offset = spot * 0.0025
            nextRound = {
              ...nextRound,
              strike: Math.round(round.direction === 'DOWN' ? spot - offset : spot + offset),
            }
          }
          return { ...c, activeRound: nextRound }
        })
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
  const currentMember = useMemo(() => {
    const address = suiContext.address
    if (!address) return null
    const normalizedAddress = address.toLowerCase()
    return (
      club.members.find((member) => member.wallet.toLowerCase() === normalizedAddress) ??
      club.members.find((member) =>
        member.wallet.toLowerCase().includes(address.slice(-6).toLowerCase()),
      ) ??
      null
    )
  }, [club.members, suiContext.address])
  const isLeader = currentMember?.role === 'leader'

  const consensus = useMemo(() => computeConsensus(round.indicators), [round.indicators])

  const buildRiskInput = useCallback(
    (overrides: Partial<RiskGateInput> = {}): RiskGateInput => ({
      oracleLastUpdate: oracleSnapshot.lastUpdateMs || null,
      oracleStaleThresholdMs: ORACLE_STALE_THRESHOLD_MS,
      expiryMinutes: round.expiryMinutes,
      minSafeExpiryMinutes: MIN_SAFE_EXPIRY_MINUTES,
      memberDusdc: balances.dusdc,
      suggestedDusdc: round.suggestedDusdc,
      signalBias: consensus.bias,
      indicators: round.indicators,
      walletConnected: suiContext.isConnected,
      predictManagerReady: suiContext.isConnected
        ? predictManagerLoading
          ? null
          : Boolean(predictManagerId)
        : null,
      oracleActive: oracleSnapshot.oracleState?.status === 'active',
      priceAvailable: Boolean(oracleSnapshot.oracleState?.latest_price?.forward),
      sviAvailable: Boolean(oracleSnapshot.oracleState?.latest_svi),
      quoteAvailable: pricingSnapshot.quote.status === 'ok',
      quoteReason: pricingSnapshot.quote.reason,
      vaultAvailable: Boolean(pricingSnapshot.vault),
      vaultReason: pricingSnapshot.vaultReason,
      ...overrides,
    }),
    [
      balances.dusdc,
      consensus.bias,
      oracleSnapshot.lastUpdateMs,
      oracleSnapshot.oracleState?.latest_price?.forward,
      oracleSnapshot.oracleState?.latest_svi,
      oracleSnapshot.oracleState?.status,
      predictManagerId,
      predictManagerLoading,
      pricingSnapshot.quote.reason,
      pricingSnapshot.quote.status,
      pricingSnapshot.vault,
      pricingSnapshot.vaultReason,
      round,
      suiContext.isConnected,
    ],
  )

  const riskEvaluation = useMemo(() => evaluateRiskGate(buildRiskInput()), [buildRiskInput])

  useEffect(() => {
    if (!host) return
    if (!suiContext.isConnected || !suiContext.address) {
      host.setSharedData(PREDICT_CLUB_WALLET_PROFILE_KEY, null)
      return
    }

    const manager = pricingSnapshot.manager
    const positions = manager?.positions ?? []
    const previous =
      (host.getSharedData(PREDICT_CLUB_WALLET_PROFILE_KEY) as PredictClubWalletProfile | null) ??
      null
    const managerId = predictManagerId ?? manager?.id ?? previous?.manager?.id ?? null
    const profilePositions = manager
      ? positions.slice(0, 6).map((position) => ({
          id: position.id,
          kind: position.kind,
          oracleId: position.oracleId,
          quantity: position.quantity,
          side: position.side,
          strike: position.strike,
          lowerStrike: position.lowerStrike,
          upperStrike: position.upperStrike,
        }))
      : (previous?.positions ?? [])
    host.setSharedData(PREDICT_CLUB_WALLET_PROFILE_KEY, {
      manager: {
        id: managerId,
        status: predictManagerLoading ? 'Loading' : managerId ? 'Ready' : 'Unavailable',
        quoteBalance: manager?.quoteBalance ?? previous?.manager?.quoteBalance ?? null,
      },
      balances,
      binaryPositions:
        manager?.positionsSize ??
        (manager
          ? positions.filter((position) => position.kind === 'binary').length
          : (previous?.binaryPositions ?? null)),
      rangePositions:
        manager?.rangePositionsSize ??
        (manager
          ? positions.filter((position) => position.kind === 'range').length
          : (previous?.rangePositions ?? null)),
      positions: profilePositions,
      vault: pricingSnapshot.vault ?? previous?.vault ?? null,
    })
  }, [
    balances,
    host,
    predictManagerId,
    predictManagerLoading,
    pricingSnapshot.manager,
    pricingSnapshot.vault,
    suiContext.address,
    suiContext.isConnected,
  ])

  const updateRoundStatus = useCallback((status: RoundStatus) => {
    store.updateClub((c) => ({ ...c, activeRound: { ...c.activeRound, status } }))
  }, [])

  const refreshOnChainOffers = useCallback(() => {
    // Drop stale cached escrow queries so the post-mutation fetch hits the chain
    invalidateEscrowCache()
    // Delay to let indexer catch up, then merge on-chain offers
    setTimeout(() => {
      fetchOnChainOffers()
        .then((onChainOffers) => {
          if (onChainOffers.length > 0) {
            store.updateClub((c) => {
              const localOnly = c.escrowOffers.filter((o) => !o.id.startsWith('0x'))
              return { ...c, escrowOffers: mergeEscrowOffers(localOnly, onChainOffers) }
            })
          }
        })
        .catch(() => {})
    }, 2000)
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

      createPredictManager: async () => {
        const address = host?.getSuiContext().address
        if (!host || !address) {
          const error = 'Wallet not connected'
          store.setToast(error)
          return { ok: false, error }
        }

        try {
          const gateway = createSuiPredictGateway()
          const tx = gateway.buildCreateManagerTx(address)
          const result = await host.signAndExecuteTransaction(tx)
          setPredictManagerLoading(true)
          const managerId = await gateway.fetchManagerId(address)
          setPredictManagerId(managerId)
          setPredictManagerLoading(false)
          store.setToast(`PredictManager created — ${result.digest.slice(0, 12)}…`)
          return { ok: true, digest: result.digest }
        } catch (error) {
          setPredictManagerLoading(false)
          const message = error instanceof Error ? error.message : 'Create PredictManager failed'
          store.setToast(message)
          return { ok: false, error: message }
        }
      },

      confirmRound: () => {
        const result = confirmRound(club, buildRiskInput())
        if (result.ok && result.club) {
          store.setClub(result.club)
          const warningCount =
            result.club.activeRound.riskChecks?.filter((c) => !c.passed).length ?? 0
          store.setToast(warningCount > 0 ? 'Round confirmed with warnings' : 'Round confirmed')
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
        const managerId = predictManagerId ?? (await gateway.fetchManagerId(address))
        if (!managerId) {
          store.setModal('fund-to-join')
          store.setToast('No PredictManager found — create one first')
          return { ok: false, error: 'No predict manager found — create one first' }
        }

        if (balances.dusdc < round.suggestedDusdc) {
          store.setModal('fund-to-join')
          store.setToast(`Need ${round.suggestedDusdc} DUSDC before executing`)
          return { ok: false, error: 'Insufficient DUSDC for execution' }
        }

        const executionRiskInput = buildRiskInput({
          walletConnected: true,
          predictManagerReady: true,
        })
        const executionRisk = evaluateRiskGate(executionRiskInput)
        if (!executionRisk.canExecute) {
          const fundingBlocked = executionRisk.warningReasons.some((c) => c.category === 'funding')
          if (fundingBlocked) store.setModal('fund-to-join')
          store.setToast(
            executionRisk.blockingReasons[0]?.message ??
              executionRisk.warningReasons[0]?.message ??
              'Resolve risk checks before executing',
          )
          return { ok: false, error: 'Risk gate blocked execution' }
        }

        // Find member ID from wallet address
        const member = currentMember
        if (!member) {
          const error = 'Connected wallet is not a club member yet'
          store.setToast(error)
          return { ok: false, error }
        }

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
          executionRiskInput,
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
          store.setToast('Escrow offer created (local)')
          store.setModal(null)
        }
        return { ok: result.ok, error: result.error }
      },

      fillEscrowOffer: (offerId: string) => {
        const result = fillEscrowOffer(club, offerId)
        if (result.ok && result.club) {
          store.setClub(result.club)
          store.setToast('Escrow filled (local)')
          store.setModal(null)
        }
        return { ok: result.ok, error: result.error }
      },

      cancelEscrowOffer: (offerId: string) => {
        const result = cancelEscrowOffer(club, offerId)
        if (result.ok && result.club) {
          store.setClub(result.club)
          store.setToast('Escrow cancelled (local)')
        }
        return { ok: result.ok, error: result.error }
      },

      createEscrowOfferOnChain: async (params) => {
        const address = host?.getSuiContext().address
        if (!host || !address) return { ok: false, error: 'Wallet not connected' }
        try {
          const result = await createOfferOnChain(
            { sender: address, signAndExecute: (tx) => host.signAndExecuteTransaction(tx) },
            params,
          )
          store.setToast(`Offer created on-chain — ${result.digest.slice(0, 12)}…`)
          store.setModal(null)
          refreshOnChainOffers()
          return { ok: true, digest: result.digest }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Create offer failed'
          store.setToast(msg)
          return { ok: false, error: msg }
        }
      },

      fillEscrowOfferOnChain: async (offer, paymentCoinId) => {
        const address = host?.getSuiContext().address
        if (!host || !address) return { ok: false, error: 'Wallet not connected' }
        try {
          const result = await fillOfferOnChain(
            { sender: address, signAndExecute: (tx) => host.signAndExecuteTransaction(tx) },
            offer,
            paymentCoinId,
          )
          store.setToast(`Offer filled on-chain — ${result.digest.slice(0, 12)}…`)
          store.setModal(null)
          refreshOnChainOffers()
          return { ok: true, digest: result.digest }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Fill offer failed'
          store.setToast(msg)
          return { ok: false, error: msg }
        }
      },

      cancelEscrowOfferOnChain: async (offer) => {
        const address = host?.getSuiContext().address
        if (!host || !address) return { ok: false, error: 'Wallet not connected' }
        try {
          const result = await cancelOfferOnChain(
            { sender: address, signAndExecute: (tx) => host.signAndExecuteTransaction(tx) },
            offer,
          )
          store.setToast(`Offer cancelled on-chain — ${result.digest.slice(0, 12)}…`)
          refreshOnChainOffers()
          return { ok: true, digest: result.digest }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Cancel offer failed'
          store.setToast(msg)
          return { ok: false, error: msg }
        }
      },

      claimSettlementOnChain: async (params) => {
        const address = host?.getSuiContext().address
        if (!host || !address) return { ok: false, error: 'Wallet not connected' }
        if (!predictManagerId) return { ok: false, error: 'No PredictManager found' }
        try {
          const result = await claimWinnings(
            club,
            {
              walletAddress: address,
              managerId: predictManagerId,
              signAndExecute: (tx) => host.signAndExecuteTransaction(tx),
            },
            params,
          )
          if (result.ok && result.club) {
            store.setClub(result.club)
            store.setToast(`Claimed — ${result.digest?.slice(0, 12)}…`)
            store.setModal(null)
          } else {
            store.setToast(result.error ?? 'Claim failed')
          }
          return { ok: result.ok, digest: result.digest, error: result.error }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Claim failed'
          store.setToast(msg)
          return { ok: false, error: msg }
        }
      },

      swapSuiToUsdc: async (suiAmount, minUsdcOut) => {
        const address = host?.getSuiContext().address
        if (!host || !address) return { ok: false, error: 'Wallet not connected' }
        const result = await swapSuiToUsdc(
          { sender: address, signAndExecute: (tx) => host.signAndExecuteTransaction(tx) },
          { suiAmount, minUsdcOut },
        )
        if (result.ok) {
          store.setToast(`Swapped ${suiAmount} SUI → USDC — ${result.digest?.slice(0, 12)}…`)
        } else {
          store.setToast(result.error ?? 'Swap failed')
        }
        return result
      },
    }),
    [balances, club, currentMember, round, oracleSnapshot, buildRiskInput, host, predictManagerId],
  )

  // ─── Primary Action ───
  const primaryAction = useMemo(() => {
    if (!suiContext.isConnected) {
      return { label: 'Connect Wallet', action: () => host?.requestConnect() }
    }

    switch (round.status) {
      case 'draft':
        return { label: 'Publish Round', action: () => actions.publishRound() }
      case 'open':
        return isLeader
          ? { label: 'Confirm Round', action: () => actions.confirmRound() }
          : { label: 'Accept Signal', action: () => updateRoundStatus('funding') }
      case 'confirmed':
      case 'funding':
        if (funding.blocked || balances.dusdc < round.suggestedDusdc) {
          return { label: 'Fund to Join', action: () => store.setModal('fund-to-join') }
        }
        return { label: 'Execute Trade', action: () => store.setModal('execute-trade') }
      case 'executed':
        return {
          label: 'Mark Settled',
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
      case 'cancelled':
        return { label: 'New Round', action: () => store.setModal('create-round') }
      default:
        return { label: 'Accept Signal', action: () => updateRoundStatus('funding') }
    }
  }, [
    actions,
    balances.dusdc,
    funding.blocked,
    host,
    round.id,
    round.status,
    round.suggestedDusdc,
    round.strike,
    isLeader,
    suiContext.isConnected,
    updateRoundStatus,
  ])

  const value: PredictClubContextValue = {
    club,
    context: { address: suiContext.address, isConnected: suiContext.isConnected },
    balances: balances,
    modal,
    setModal: store.setModal,
    selectedOffer,
    setSelectedOffer: store.setSelectedOffer,
    primaryAction,
    fundingRecommendation: {
      route: funding.route,
      label: funding.label,
      reason: funding.reason,
      blocked: funding.blocked,
    },
    updateRoundStatus,
    host,
    actions,
    riskEvaluation,
    consensus,
    toastMessage,
    oracleSnapshot,
    pricingSnapshot,
    currentMember,
    predictManagerId,
    predictManagerLoading,
  }

  return <PredictClubContext.Provider value={value}>{children}</PredictClubContext.Provider>
}
