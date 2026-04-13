// Network selector component

import { NETWORKS, type Network } from './types'

interface NetworkSelectorProps {
  current: Network
  onChange: (network: Network) => void
}

export function NetworkSelector({ current, onChange }: NetworkSelectorProps) {
  return (
    <div className="swp__network">
      {NETWORKS.map((n) => (
        <button
          key={n}
          className={`swp__network-btn ${current === n ? 'swp__network-btn--active' : ''}`}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  )
}
