import { usePredictClub } from './PredictClubContext'
import { Icon } from './shared'
import type { ModalKind } from '../domain/types'

export function FundingRouterPanel() {
  const { setModal } = usePredictClub()

  const nodes = [
    ['Ready', 'Direct Wallet', 'DUSDC', 'fund-to-join'],
    ['Standby', 'Swap', 'DeepBook', 'fund-to-join'],
    ['Standby', 'Borrow', 'Scallop', 'scallop-borrow'],
    ['Pending', 'Escrow', 'Predict P2P', 'create-escrow'],
  ] as const

  return (
    <>
      <header>
        <Icon name="route" />
        <span>Funding Router</span>
      </header>
      <div className="pc-route-strip">
        {nodes.map(([state, label, value, modal], index) => (
          <button
            className={`pc-route-node ${index === 0 ? 'pc-route-active' : ''}`}
            key={`${label}-${value}`}
            type="button"
            onClick={() => setModal(modal as ModalKind)}
          >
            <span>{state}</span>
            <em>{label}</em>
            <strong>{value}</strong>
          </button>
        ))}
      </div>
    </>
  )
}
