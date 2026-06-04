import { usePredictClub } from './PredictClubContext'
import { formatUsd, labelize } from './shared'

export function EscrowOffersPanel() {
  const { club, setModal, setSelectedOffer } = usePredictClub()

  return (
    <>
      <header>
        <span>P2P Escrow Offers</span>
        <button className="pc-link-button" type="button" onClick={() => setModal('create-escrow')}>
          Create
        </button>
      </header>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Amount</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {club.escrowOffers.map((offer) => (
            <tr
              key={offer.id}
              onClick={() => {
                setSelectedOffer(offer)
                setModal('fill-escrow')
              }}
            >
              <td>{offer.maker}</td>
              <td>
                {formatUsd(offer.offerAmount)} {offer.offerAsset}
              </td>
              <td>{offer.status === 'open' ? '0.05%' : labelize(offer.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
