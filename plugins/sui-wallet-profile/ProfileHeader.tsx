// Profile header — shows address, SuiNS name, avatar, copy button

import { useState } from 'react'
import { shortenAddress } from './types'

interface ProfileHeaderProps {
  address: string
  suinsName: string | null
  walletName: string
  walletIcon?: string
  onDisconnect: () => void
}

export function ProfileHeader({
  address,
  suinsName,
  walletName,
  walletIcon,
  onDisconnect,
}: ProfileHeaderProps) {
  const [copied, setCopied] = useState(false)

  const copyAddress = async () => {
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
          <button className="swp__copy-btn" onClick={copyAddress} title="Copy address">
            {copied ? '✓' : '⎘'}
          </button>
        </div>
        <div className="swp__profile-wallet">{walletName}</div>
      </div>
      <button className="swp__disconnect-btn" onClick={onDisconnect}>
        Disconnect
      </button>
    </div>
  )
}
