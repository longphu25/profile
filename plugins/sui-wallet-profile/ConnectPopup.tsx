// Connect popup — shows list of detected wallets

import { useState } from 'react'

interface ConnectPopupProps {
  wallets: { name: string; icon?: string }[]
  onConnect: (wallet: { name: string; icon?: string }) => void
  onClose: () => void
  connecting: boolean
}

export function ConnectPopup({ wallets, onConnect, onClose, connecting }: ConnectPopupProps) {
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async (wallet: { name: string; icon?: string }) => {
    setError(null)
    try {
      onConnect(wallet)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  return (
    <div className="swp__overlay" onClick={onClose}>
      <div className="swp__popup" onClick={(e) => e.stopPropagation()}>
        <div className="swp__popup-header">
          <h4 className="swp__popup-title">Connect Wallet</h4>
          <button className="swp__popup-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {wallets.length === 0 ? (
          <div className="swp__popup-empty">
            No wallets detected. Install a Sui wallet extension.
          </div>
        ) : (
          <div className="swp__popup-list">
            {wallets.map((w) => (
              <button
                key={w.name}
                className="swp__wallet-btn"
                onClick={() => handleConnect(w)}
                disabled={connecting}
              >
                {w.icon && <img src={w.icon} alt="" className="swp__wallet-icon" />}
                <span className="swp__wallet-name">{w.name}</span>
                <span className="swp__wallet-arrow">→</span>
              </button>
            ))}
          </div>
        )}

        {connecting && <div className="swp__popup-status">Connecting...</div>}
        {error && <div className="swp__popup-error">{error}</div>}
      </div>
    </div>
  )
}
