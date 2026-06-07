import { usePredictClub } from './PredictClubContext'
import { formatUsd, labelize } from './shared'

export function EscrowOffersPanel() {
  const { club, actions, setModal, setSelectedOffer, context } = usePredictClub()

  function handleCancel(offerId: string) {
    const offer = club.escrowOffers.find((o) => o.id === offerId)
    if (!offer) return

    // On-chain cancel if wallet connected and offer has on-chain ID format
    if (context.isConnected && offer.id.startsWith('0x')) {
      actions.cancelEscrowOfferOnChain(offer)
    } else {
      actions.cancelEscrowOffer(offerId)
    }
  }

  function handleFill(offerId: string) {
    const offer = club.escrowOffers.find((o) => o.id === offerId)
    if (offer) {
      setSelectedOffer(offer)
      setModal('fill-escrow')
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'text-primary-fixed-dim'
      case 'filled':
        return 'text-secondary-fixed'
      case 'expired':
        return 'text-on-surface-variant'
      case 'cancelled':
        return 'text-error'
      default:
        return 'text-on-surface-variant'
    }
  }

  const isOwnOffer = (maker: string) => {
    if (!context.address) return false
    return maker.toLowerCase() === context.address.toLowerCase() ||
      maker.toLowerCase().includes(context.address.slice(-4).toLowerCase())
  }

  return (
    <>
      <div className="p-xs bg-surface-container-high border-b border-outline-variant px-md flex items-center justify-between">
        <span className="font-label text-label-caps text-on-surface-variant uppercase">
          P2P Escrow Offers
        </span>
        <button
          type="button"
          onClick={() => setModal('create-escrow')}
          className="font-label text-label-caps text-primary-fixed-dim flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          Create Offer
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-highest font-label text-label-caps text-on-surface-variant uppercase sticky top-0">
              <th className="p-2 font-normal">Provider</th>
              <th className="p-2 font-normal text-right">Amount</th>
              <th className="p-2 font-normal text-right">Status</th>
              <th className="p-2 font-normal text-right">Action</th>
            </tr>
          </thead>
          <tbody className="font-data text-data-sm">
            {club.escrowOffers.map((offer) => (
              <tr
                key={offer.id}
                className="border-b border-outline-variant/50 hover:bg-surface-bright transition-colors"
              >
                <td className="p-2 text-on-surface">
                  {offer.maker}
                  {offer.id.startsWith('0x') && (
                    <span className="ml-1 text-[9px] text-primary-fixed-dim/60">on-chain</span>
                  )}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {formatUsd(offer.offerAmount)} {offer.offerAsset}
                </td>
                <td className={`p-2 text-right ${statusColor(offer.status)}`}>
                  {labelize(offer.status)}
                </td>
                <td className="p-2 text-right">
                  {offer.status === 'open' && (
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleFill(offer.id)}
                        className="px-2 py-0.5 rounded bg-primary-fixed-dim/20 text-primary-fixed-dim text-[11px] cursor-pointer hover:bg-primary-fixed-dim/30 transition-colors"
                      >
                        Fill
                      </button>
                      {isOwnOffer(offer.maker) && (
                        <button
                          type="button"
                          onClick={() => handleCancel(offer.id)}
                          className="px-2 py-0.5 rounded bg-error/20 text-error text-[11px] cursor-pointer hover:bg-error/30 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {club.escrowOffers.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-on-surface-variant">
                  No offers available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
