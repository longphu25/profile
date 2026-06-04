import { usePredictClub } from './PredictClubContext'
import type { ModalKind } from '../domain/types'

export function FundingRouterPanel() {
  const { setModal } = usePredictClub()

  const nodes: Array<[string, string, string, ModalKind, boolean]> = [
    ['Active', 'Direct Wallet', '500 DUSDC', 'fund-to-join', true],
    ['Standby', 'Swap', 'DeepBook', 'fund-to-join', false],
    ['Standby', 'Borrow', 'Scallop', 'scallop-borrow', false],
    ['Pending', 'Escrow', 'Predict P2P', 'create-escrow', false],
  ]

  return (
    <>
      <div className="p-xs bg-surface-container-high border-b border-outline-variant px-md flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px] text-secondary-fixed">route</span>
        <span className="font-label text-label-caps text-on-surface-variant uppercase">
          Funding Router
        </span>
      </div>
      <div className="flex-1 p-sm flex gap-md overflow-x-auto items-center">
        {nodes.map(([state, label, value, modal, active]) => (
          <button
            key={`${label}-${value}`}
            type="button"
            onClick={() => setModal(modal)}
            className={`min-w-[130px] h-20 bg-surface-container-highest rounded-xl p-sm flex flex-col justify-between relative hover-lift cursor-pointer ${
              active
                ? 'border border-primary-fixed-dim glow-mint flow-connector text-primary-fixed-dim'
                : 'border border-outline-variant opacity-60 flow-connector text-outline-variant'
            }`}
          >
            <span
              className={`font-label text-label-caps ${active ? 'text-primary-fixed-dim' : 'text-on-surface-variant'}`}
            >
              {state}
            </span>
            <span className="font-data text-data-sm text-on-surface">{label}</span>
            <span className="font-data text-data-md text-on-surface font-bold">{value}</span>
          </button>
        ))}
      </div>
    </>
  )
}
