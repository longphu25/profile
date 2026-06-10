import { useMemo } from 'react'
import { usePredictClub } from './usePredictClub'
import { recommendFundingRoute } from '../application/recommendFundingRoute'
import type { AssetBalances, FundingRoute, ModalKind, PredictionRound } from '../domain/types'

interface FundingCardDisplay {
  route: FundingRoute
  label: string
  status: 'ready' | 'available' | 'needs-review' | 'blocked'
  value: string
  modal: ModalKind
}

function buildFundingCards(balances: AssetBalances, round: PredictionRound): FundingCardDisplay[] {
  const primary = recommendFundingRoute(balances, round)

  const cards: FundingCardDisplay[] = [
    {
      route: 'ready-with-dusdc',
      label: 'Direct DUSDC',
      status: balances.dusdc >= round.suggestedDusdc ? 'ready' : 'blocked',
      value: `${Math.floor(balances.dusdc)} DUSDC`,
      modal: 'fund-to-join',
    },
    {
      route: 'club-escrow-usdc-to-dusdc',
      label: 'Escrow USDC→DUSDC',
      status: balances.usdc >= round.suggestedDusdc ? 'available' : 'blocked',
      value: `${Math.floor(balances.usdc)} USDC`,
      modal: 'create-escrow',
    },
    {
      route: 'deepbook-sui-to-usdc',
      label: 'Swap SUI→USDC',
      status: balances.sui > 2 ? 'available' : 'blocked',
      value: `${balances.sui.toFixed(1)} SUI`,
      modal: 'fund-to-join',
    },
    {
      route: 'bridge-assets-to-sui',
      label: 'Bridge to Sui',
      status: 'needs-review',
      value: 'External',
      modal: 'fund-to-join',
    },
  ]

  // Mark the recommended route
  return cards.map((card) => ({
    ...card,
    status: card.route === primary.route && !primary.blocked ? 'ready' : card.status,
  }))
}

export function FundingRouterPanel() {
  const { balances, club, setModal } = usePredictClub()
  const round = club.activeRound

  const cards = useMemo(() => buildFundingCards(balances, round), [balances, round])

  return (
    <>
      <div className="p-xs bg-surface-container-high border-b border-outline-variant px-md flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px] text-secondary-fixed">route</span>
        <span className="font-label text-label-caps text-on-surface-variant uppercase">
          Funding Router
        </span>
      </div>
      <div className="flex-1 p-sm flex gap-md overflow-x-auto items-center">
        {cards.map((card) => {
          const isActive = card.status === 'ready'
          const isAvailable = card.status === 'available'
          return (
            <button
              key={card.route}
              type="button"
              onClick={() => setModal(card.modal)}
              className={`min-w-[130px] h-20 bg-surface-container-highest rounded-xl p-sm flex flex-col justify-between relative hover-lift cursor-pointer ${
                isActive
                  ? 'border border-primary-fixed-dim glow-mint flow-connector text-primary-fixed-dim'
                  : isAvailable
                    ? 'border border-secondary-fixed/50 flow-connector text-secondary-fixed'
                    : 'border border-outline-variant opacity-60 flow-connector text-outline-variant'
              }`}
            >
              <span
                className={`font-label text-label-caps ${
                  isActive
                    ? 'text-primary-fixed-dim'
                    : isAvailable
                      ? 'text-secondary-fixed'
                      : 'text-on-surface-variant'
                }`}
              >
                {card.status === 'ready'
                  ? 'Ready'
                  : card.status === 'available'
                    ? 'Available'
                    : card.status === 'needs-review'
                      ? 'Review'
                      : 'Blocked'}
              </span>
              <span className="font-data text-data-sm text-on-surface">{card.label}</span>
              <span className="font-data text-data-md text-on-surface font-bold">{card.value}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
