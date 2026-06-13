import { useState } from 'react'
import { usePredictClub } from '../usePredictClub'
import { formatCompactDusdc, formatUsd, labelize } from '../shared'
import type { EscrowOfferView, FundingCard, HistoryRow } from '../../domain/types'

/**
 * Bottom dock (C5): funding routes, P2P escrow offers, and round history as a
 * tabbed reference surface. Tabs (not three columns) keep the dock one-screen
 * shallow so it never steals vertical space from the king chart. Tables follow
 * the new spec: no vertical borders, color-coded PnL, sticky header. Funding
 * cards label preview-only routes so they cannot be mistaken for executed.
 *
 * Reads the shared snapshot only (no forked data). Em-dash is banned; tab
 * separators are plain text.
 */

type Tab = 'funding' | 'offers' | 'history'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'funding', label: 'Funding', icon: 'account_balance' },
  { id: 'offers', label: 'Offers', icon: 'swap_horiz' },
  { id: 'history', label: 'History', icon: 'history' },
]

function fundingStatusClass(status: FundingCard['status']): string {
  switch (status) {
    case 'ready':
      return 'border-primary-fixed-dim text-primary-fixed-dim'
    case 'available':
      return 'border-secondary-fixed/40 text-secondary-fixed'
    case 'needs-review':
      return 'border-tertiary-fixed-dim/40 text-tertiary-fixed-dim'
    default:
      return 'border-outline-variant text-on-surface-variant/50'
  }
}

function FundingPanel() {
  const { club, setModal } = usePredictClub()
  return (
    <div className="flex gap-sm overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {club.fundingCards.map((card) => {
        const ready = card.status === 'ready'
        return (
          <button
            key={card.route}
            type="button"
            onClick={() => ready && setModal('fund-to-join')}
            disabled={!ready}
            className={[
              'min-w-[150px] shrink-0 rounded-lg border bg-surface-container-highest p-sm text-left transition-colors',
              fundingStatusClass(card.status),
              ready ? 'cursor-pointer hover:bg-surface-bright' : 'cursor-not-allowed opacity-70',
            ].join(' ')}
            title={card.description}
          >
            <span className="block font-label text-label-caps uppercase tracking-wider">
              {labelize(card.status)}
            </span>
            <span className="block truncate font-data text-data-sm text-on-surface">
              {card.title}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function offerStatusClass(status: EscrowOfferView['status']): string {
  return status === 'open' ? 'text-primary-fixed-dim' : 'text-on-surface-variant/60'
}

function OffersPanel() {
  const { club, setSelectedOffer, setModal } = usePredictClub()
  if (club.escrowOffers.length === 0) {
    return <Empty>No open offers</Empty>
  }
  return (
    <table className="w-full text-left">
      <thead className="sticky top-0 bg-surface-container">
        <tr className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant/70">
          <th className="pb-1 font-normal">Maker</th>
          <th className="pb-1 text-right font-normal">Offer</th>
          <th className="pb-1 text-right font-normal">Want</th>
        </tr>
      </thead>
      <tbody className="font-data text-data-sm">
        {club.escrowOffers.slice(0, 8).map((offer) => (
          <tr
            key={offer.id}
            className="cursor-pointer transition-colors hover:bg-surface-bright"
            onClick={() => {
              setSelectedOffer(offer)
              setModal('fill-escrow')
            }}
          >
            <td className={`py-[3px] ${offerStatusClass(offer.status)}`}>{offer.maker}</td>
            <td className="py-[3px] text-right tabular-nums">
              {formatUsd(offer.offerAmount)} {offer.offerAsset}
            </td>
            <td className="py-[3px] text-right tabular-nums">
              {formatUsd(offer.wantAmount)} {offer.wantAsset}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function historyPnlClass(row: HistoryRow): string {
  if (row.pnlDusdc > 0) return 'text-primary-fixed-dim'
  if (row.pnlDusdc < 0) return 'text-error'
  return 'text-on-surface-variant'
}

function HistoryPanel() {
  const { club } = usePredictClub()
  if (club.history.length === 0) {
    return <Empty>No rounds yet</Empty>
  }
  return (
    <table className="w-full text-left">
      <thead className="sticky top-0 bg-surface-container">
        <tr className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant/70">
          <th className="pb-1 font-normal">Round</th>
          <th className="pb-1 font-normal">Result</th>
          <th className="pb-1 text-right font-normal">PnL</th>
        </tr>
      </thead>
      <tbody className="font-data text-data-sm">
        {club.history.slice(0, 8).map((row) => (
          <tr key={row.id} className="transition-colors hover:bg-surface-bright">
            <td className="py-[3px] text-on-surface-variant">{row.id}</td>
            <td className="py-[3px]">{labelize(row.result)}</td>
            <td className={`py-[3px] text-right tabular-nums ${historyPnlClass(row)}`}>
              {formatCompactDusdc(row.pnlDusdc, { signed: true })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-sm font-data text-data-sm text-on-surface-variant/50">{children}</p>
}

export function DockTabs({ className = '' }: { className?: string }) {
  const [tab, setTab] = useState<Tab>('funding')

  return (
    <div
      data-pc-dock-tabs
      className={`flex min-h-0 flex-col bg-surface-container ${className}`}
      aria-label="Reference dock"
    >
      <div className="flex items-center gap-1 border-b border-outline-variant px-md" role="tablist">
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={[
                'flex items-center gap-1 border-b-2 px-sm py-sm font-label text-label-caps uppercase tracking-wider transition-colors',
                active
                  ? 'border-primary-fixed-dim text-primary-fixed-dim'
                  : 'border-transparent text-on-surface-variant/60 hover:text-on-surface-variant',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
            </button>
          )
        })}
      </div>
      <div className="min-h-0 overflow-auto px-md py-sm" role="tabpanel">
        {tab === 'funding' && <FundingPanel />}
        {tab === 'offers' && <OffersPanel />}
        {tab === 'history' && <HistoryPanel />}
      </div>
    </div>
  )
}
