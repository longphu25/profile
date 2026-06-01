import { DeepBookDesktopNav } from './DeepBookNav'
import type { NavGroup } from '../config/nav'

interface WalletLike {
  name: string
  icon?: string
  [key: string]: unknown
}

interface AccountLike {
  address: string
}

interface WalletBarProps {
  activeGroup: NavGroup
  isConnected: boolean
  account: AccountLike | null
  onConnectClick: () => void
  onDisconnect: () => void
  onGroupClick: (group: NavGroup) => void
}

interface WalletModalProps {
  wallets: readonly WalletLike[]
  onClose: () => void
  onConnect: (wallet: WalletLike) => Promise<void>
}

const fmtAddr = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

export function WalletBar({
  activeGroup,
  isConnected,
  account,
  onConnectClick,
  onDisconnect,
  onGroupClick,
}: WalletBarProps) {
  return (
    <header className="sticky top-0 z-40 mx-3 mt-3">
      <div
        className="mx-auto max-w-[1400px] flex items-center justify-between px-4 py-2.5 rounded-2xl border"
        style={{
          background: 'var(--color-panel)',
          borderColor: 'var(--color-line)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="text-sm font-bold"
            style={{ color: 'var(--color-mint)', fontFamily: 'var(--font-satoshi)' }}
          >
            DeepBook Suite
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: 'rgba(128,255,213,0.08)',
              color: 'var(--color-mint)',
              border: '1px solid rgba(128,255,213,0.2)',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: 'var(--color-mint)' }}
            />
            Testnet
          </span>
        </div>

        <DeepBookDesktopNav activeGroup={activeGroup} onGroupClick={onGroupClick} />

        <div className="flex items-center gap-2">
          {isConnected && account ? (
            <button
              type="button"
              onClick={onDisconnect}
              className="rounded-full px-3 py-1.5 text-[11px] font-medium cursor-pointer"
              style={{
                background: 'rgba(128,255,213,0.1)',
                color: 'var(--color-mint)',
                border: '1px solid rgba(128,255,213,0.2)',
              }}
            >
              {fmtAddr(account.address)}
            </button>
          ) : (
            <button
              type="button"
              onClick={onConnectClick}
              className="rounded-full px-4 py-1.5 text-[11px] font-semibold cursor-pointer"
              style={{ background: 'var(--color-mint)', color: 'var(--color-ink)' }}
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

export function WalletConnectModal({ wallets, onClose, onConnect }: WalletModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(7,16,17,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 w-80"
        style={{ background: 'var(--color-panel)', border: '1px solid var(--color-line)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          Connect Wallet
        </h3>
        {wallets.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            No wallets detected. Install Sui Wallet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {wallets.map((wallet) => (
              <button
                type="button"
                key={wallet.name}
                onClick={() => onConnect(wallet)}
                className="flex items-center gap-3 p-3 rounded-xl text-sm cursor-pointer"
                style={{
                  background: 'rgba(190,255,234,0.06)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-line)',
                }}
              >
                {wallet.icon && (
                  <img src={wallet.icon} alt={wallet.name} className="h-5 w-5 rounded" />
                )}
                {wallet.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
