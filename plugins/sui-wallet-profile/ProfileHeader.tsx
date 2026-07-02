// Profile header — shows address, SuiNS name, avatar, copy button

import { useState } from 'react'
import { getSuiScanAccountUrl, isFullSuiAddress, shortenAddress, type Network } from './types'

interface ProfileHeaderProps {
  address: string
  suinsName: string | null
  walletName: string
  walletIcon?: string
  network?: Network
  onDisconnect: () => void
}

export function ProfileHeader({
  address,
  suinsName,
  walletName,
  walletIcon,
  network = 'testnet',
  onDisconnect,
}: ProfileHeaderProps) {
  const [copied, setCopied] = useState(false)

  const copyAddress = async () => {
    if (!isFullSuiAddress(address)) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="swp__profile">
      <div className="swp__profile-avatar">
        {walletIcon ? (
          <img src={walletIcon} alt="" className="swp__profile-icon" />
        ) : (
          <div className="swp__profile-placeholder">
            {(suinsName || address).slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="swp__profile-info">
        {suinsName && <div className="swp__profile-name">{suinsName}</div>}
        <div className="swp__profile-addr">
          <span>{shortenAddress(address)}</span>
          <button
            type="button"
            className="swp__copy-btn"
            onClick={copyAddress}
            title="Copy address"
          >
            {copied ? '✓' : '⎘'}
          </button>
          <a
            className="swp__copy-btn"
            href={getSuiScanAccountUrl(address, network)}
            target="_blank"
            rel="noopener noreferrer"
            title="View on SuiScan"
          >
            ↗
          </a>
        </div>
        <div className="swp__profile-wallet">{walletName}</div>
      </div>
      <button type="button" className="swp__disconnect-btn" onClick={onDisconnect}>
        Disconnect
      </button>
    </div>
  )
}
