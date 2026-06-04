import { usePredictClub } from './PredictClubContext'
import { formatUsd, labelize } from './shared'

export function EscrowOffersPanel() {
  const { club, setModal, setSelectedOffer } = usePredictClub()

  return (
    <>
      <div className="p-xs bg-surface-container-high border-b border-outline-variant px-md flex items-center justify-between">
        <span className="font-label text-label-caps text-on-surface-variant uppercase">
          P2P Escrow Offers
        </span>
        <span className="font-data text-data-sm text-on-surface-variant">
          {club.escrowOffers.length} available
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-highest font-label text-label-caps text-on-surface-variant uppercase sticky top-0">
              <th className="p-2 font-normal">Provider</th>
              <th className="p-2 font-normal text-right">Amount</th>
              <th className="p-2 font-normal text-right">Rate</th>
            </tr>
          </thead>
          <tbody className="font-data text-data-sm">
            {club.escrowOffers.map((offer) => (
              <tr
                key={offer.id}
                className="border-b border-outline-variant/50 hover:bg-surface-bright transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedOffer(offer)
                  setModal('fill-escrow')
                }}
              >
                <td className="p-2 text-on-surface">{offer.maker}</td>
                <td className="p-2 text-right tabular-nums">
                  {formatUsd(offer.offerAmount)} {offer.offerAsset}
                </td>
                <td className="p-2 text-right tabular-nums text-secondary-fixed">
                  {offer.status === 'open' ? '0.05%' : labelize(offer.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
