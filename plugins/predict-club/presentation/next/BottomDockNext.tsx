import { usePredictClub } from '../usePredictClub'
import { formatCompactDusdc, formatUsd, labelize } from '../shared'
import { PanelShell } from './PanelShell'
import type { FundingCard, EscrowOfferView, HistoryRow } from '../../domain/types'

/**
 * Bottom dock (R6) — funding routes, P2P escrow offers, and round history in a
 * single collapsible band. Reference tables stay legible at density without
 * stealing focus from the action path (ActionRail, R2). Funding cards label
 * preview-only routes clearly so they cannot be mistaken for executed trades.
 */

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

function FundingColumn() {
  const { club, setModal } = usePredictClub()
  return (
    <div className="flex flex-col gap-xs min-w-0">
      <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
        Funding Router
      </span>
      <div className="flex gap-sm overflow-x-auto pb-1">
        {club.fundingCards.map((card) => {
          const ready = card.status === 'ready'
          return (
            <button
              key={card.route}
              type="button"
              onClick={() => ready && setModal('fund-to-join')}
              disabled={!ready}
              className={[
                'min-w-[130px] shrink-0 rounded-lg border bg-surface-container-highest p-sm text-left transition-colors',
                fundingStatusClass(card.status),
                ready ? 'cursor-pointer hover:bg-surface-bright' : 'cursor-not-allowed opacity-70',
              ].join(' ')}
              title={card.description}
            >
              <span className="font-label text-label-caps uppercase block">
                {labelize(card.status)}
              </span>
              <span className="font-data text-data-sm text-on-surface block truncate">
                {card.title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function offerStatusClass(status: EscrowOfferView['status']): string {
  return status === 'open' ? 'text-primary-fixed-dim' : 'text-on-surface-variant/60'
}

function OffersColumn() {
  const { club, setSelectedOffer, setModal } = usePredictClub()
  return (
    <div className="flex flex-col gap-xs min-w-0">
      <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
        P2P Escrow Offers
      </span>
      {club.escrowOffers.length === 0 ? (
        <span className="font-data text-data-sm text-on-surface-variant/50 py-sm">
          No open offers
        </span>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="font-label text-label-caps uppercase text-on-surface-variant/70">
              <th className="font-normal pb-1">Maker</th>
              <th className="font-normal pb-1 text-right">Offer</th>
              <th className="font-normal pb-1 text-right">Want</th>
            </tr>
          </thead>
          <tbody className="font-data text-data-sm">
            {club.escrowOffers.slice(0, 4).map((offer) => (
              <tr
                key={offer.id}
                className="cursor-pointer hover:bg-surface-bright transition-colors"
                onClick={() => {
                  setSelectedOffer(offer)
                  setModal('fill-escrow')
                }}
              >
                <td className={`py-[2px] ${offerStatusClass(offer.status)}`}>{offer.maker}</td>
                <td className="py-[2px] text-right tabular-nums">
                  {formatUsd(offer.offerAmount)} {offer.offerAsset}
                </td>
                <td className="py-[2px] text-right tabular-nums">
                  {formatUsd(offer.wantAmount)} {offer.wantAsset}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function historyPnlClass(row: HistoryRow): string {
  if (row.pnlDusdc > 0) return 'text-primary-fixed-dim'
  if (row.pnlDusdc < 0) return 'text-error'
  return 'text-on-surface-variant'
}

function HistoryColumn() {
  const { club } = usePredictClub()
  const totalPnl = club.history.reduce((sum, row) => sum + row.pnlDusdc, 0)
  return (
    <div className="flex flex-col gap-xs min-w-0">
      <div className="flex items-center justify-between">
        <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
          Round History
        </span>
        <span
          className={`font-data text-data-sm tabular-nums ${totalPnl >= 0 ? 'text-primary-fixed-dim' : 'text-error'}`}
        >
          {formatCompactDusdc(totalPnl, { signed: true })}
        </span>
      </div>
      {club.history.length === 0 ? (
        <span className="font-data text-data-sm text-on-surface-variant/50 py-sm">
          No rounds yet
        </span>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="font-label text-label-caps uppercase text-on-surface-variant/70">
              <th className="font-normal pb-1">Round</th>
              <th className="font-normal pb-1">Result</th>
              <th className="font-normal pb-1 text-right">PnL</th>
            </tr>
          </thead>
          <tbody className="font-data text-data-sm">
            {club.history.slice(0, 4).map((row) => (
              <tr key={row.id} className="hover:bg-surface-bright transition-colors">
                <td className="py-[2px] text-on-surface-variant">{row.id}</td>
                <td className="py-[2px]">{labelize(row.result)}</td>
                <td className={`py-[2px] text-right tabular-nums ${historyPnlClass(row)}`}>
                  {formatCompactDusdc(row.pnlDusdc, { signed: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function BottomDockNext({ className }: { className?: string }) {
  return (
    <PanelShell
      bordered={false}
      title="Funding · Offers · History"
      icon="dock_to_bottom"
      collapsible
      className={className}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        <FundingColumn />
        <OffersColumn />
        <HistoryColumn />
      </div>
    </PanelShell>
  )
}
