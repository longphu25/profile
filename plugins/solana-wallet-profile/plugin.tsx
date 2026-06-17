// Solana Wallet Profile Plugin — main entry
// Connects via Phantom OR picks from stored dev wallets (solana-create-wallet plugin).
// Shows wallet address and SOL balance. Shares context for other plugins.

import type { Plugin, HostAPI } from '../../src/plugins/types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback } from 'react'
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js'
import {
  SOLANA_NETWORKS,
  SOLANA_SHARED_KEY,
  shortenAddress,
  getSolanaExplorerAccountUrl,
  formatLamports,
  type SolanaNetwork,
  type SolanaTokenBalance,
  type SolanaWalletProfile,
} from './types'
import './style.css'

let sharedHost: SuiHostAPI | null = null

// --- Stored wallet type (from solana-create-wallet plugin) ---
const STORAGE_KEY = 'solana_dev_wallets'

interface StoredWallet {
  address: string
  publicKey: string
  secretKey: string
  mnemonic: string | null
  createdAt: number
}

function loadStoredWallets(): StoredWallet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// --- Solana Connection Factory ---
const connectionCache = new Map<SolanaNetwork, Connection>()

function getConnection(network: SolanaNetwork): Connection {
  let conn = connectionCache.get(network)
  if (!conn) {
    conn = new Connection(clusterApiUrl(network), 'confirmed')
    connectionCache.set(network, conn)
  }
  return conn
}

// --- Plugin Component ---
function SolanaWalletProfileContent() {
  const [network, setNetwork] = useState<SolanaNetwork>('devnet')
  const [address, setAddress] = useState<string | null>(null)
  const [balances, setBalances] = useState<SolanaTokenBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [walletName, setWalletName] = useState<string | undefined>()
  const [copied, setCopied] = useState(false)
  const [storedWallets, setStoredWallets] = useState<StoredWallet[]>(loadStoredWallets)
  const [showStoredPicker, setShowStoredPicker] = useState(false)

  // Refresh stored wallets periodically (in case create-wallet plugin adds new ones)
  useEffect(() => {
    const id = setInterval(() => setStoredWallets(loadStoredWallets()), 3000)
    return () => clearInterval(id)
  }, [])

  // Check for Phantom or other Solana wallets
  const getProvider = useCallback(() => {
    if ('phantom' in window) {
      const provider = (window as unknown as { phantom: { solana?: SolanaProvider } }).phantom
        ?.solana
      if (provider?.isPhantom) return provider
    }
    if ('solana' in window) {
      return (window as unknown as { solana: SolanaProvider }).solana
    }
    return null
  }, [])

  // Fetch SOL balance
  const fetchBalance = useCallback(
    async (addr: string, net: SolanaNetwork) => {
      setLoading(true)
      setError(null)
      try {
        const conn = getConnection(net)
        const pubkey = new PublicKey(addr)
        const lamports = await conn.getBalance(pubkey)
        const solBalance: SolanaTokenBalance = {
          mint: 'native',
          symbol: 'SOL',
          balance: String(lamports),
          decimals: 9,
        }
        setBalances([solBalance])

        // Share profile via host API
        if (sharedHost) {
          const profile: SolanaWalletProfile = {
            address: addr,
            network: net,
            balances: [solBalance],
            walletName,
          }
          sharedHost.setSharedData(SOLANA_SHARED_KEY, profile)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch balance')
      } finally {
        setLoading(false)
      }
    },
    [walletName],
  )

  // Connect via Phantom
  const handleConnectPhantom = async () => {
    const provider = getProvider()
    if (!provider) {
      setError('No Solana wallet found. Install Phantom or use a stored dev wallet.')
      return
    }
    setConnecting(true)
    setError(null)
    try {
      const resp = await provider.connect()
      const addr = resp.publicKey.toString()
      setAddress(addr)
      setWalletName(provider.isPhantom ? 'Phantom' : 'Solana Wallet')
      await fetchBalance(addr, network)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  // Connect via stored wallet
  const handleSelectStored = (wallet: StoredWallet) => {
    setAddress(wallet.address)
    setWalletName('Dev Wallet (stored)')
    setShowStoredPicker(false)
    fetchBalance(wallet.address, network)
  }

  // Disconnect
  const handleDisconnect = async () => {
    const provider = getProvider()
    if (provider && walletName !== 'Dev Wallet (stored)') {
      try {
        await provider.disconnect()
      } catch {
        /* ignore */
      }
    }
    setAddress(null)
    setBalances([])
    setWalletName(undefined)
    if (sharedHost) sharedHost.setSharedData(SOLANA_SHARED_KEY, null)
  }

  // Network change
  const handleNetworkChange = (net: SolanaNetwork) => {
    setNetwork(net)
    if (address) fetchBalance(address, net)
  }

  // Copy address
  const handleCopy = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Auto-reconnect if Phantom was previously connected
  useEffect(() => {
    const provider = getProvider()
    if (provider?.isConnected && provider.publicKey) {
      const addr = provider.publicKey.toString()
      setAddress(addr)
      setWalletName(provider.isPhantom ? 'Phantom' : 'Solana Wallet')
      fetchBalance(addr, network)
    }
  }, [getProvider, fetchBalance, network])

  // Not connected state
  if (!address) {
    return (
      <div className="sol-wp">
        <div className="sol-wp__header">
          <h3 className="sol-wp__title">Solana Wallet</h3>
          <span className="sol-wp__badge sol-wp__badge--required">Required</span>
        </div>
        <p className="sol-wp__desc">Connect via browser wallet or select a stored dev wallet</p>

        {/* Network selector */}
        <div className="sol-wp__network-select">
          {SOLANA_NETWORKS.map((net) => (
            <button
              key={net}
              className={`sol-wp__network-btn ${net === network ? 'sol-wp__network-btn--active' : ''}`}
              onClick={() => handleNetworkChange(net)}
            >
              {net}
            </button>
          ))}
        </div>

        {/* Connect buttons */}
        <button
          className="sol-wp__connect-btn"
          onClick={handleConnectPhantom}
          disabled={connecting}
        >
          {connecting ? 'Connecting...' : 'Connect Phantom'}
        </button>

        {/* Stored wallets section */}
        {storedWallets.length > 0 && (
          <div className="sol-wp__stored">
            <button
              className="sol-wp__stored-toggle"
              onClick={() => setShowStoredPicker(!showStoredPicker)}
            >
              {showStoredPicker ? 'Hide' : 'Use'} Stored Dev Wallets ({storedWallets.length})
            </button>

            {showStoredPicker && (
              <div className="sol-wp__stored-list">
                {storedWallets.map((w) => (
                  <button
                    key={w.address}
                    className="sol-wp__stored-item"
                    onClick={() => handleSelectStored(w)}
                  >
                    <span className="sol-wp__stored-addr">{shortenAddress(w.address, 6)}</span>
                    <span className="sol-wp__stored-date">
                      {new Date(w.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <div className="sol-wp__error">{error}</div>}
      </div>
    )
  }

  // Connected state
  const explorerUrl = getSolanaExplorerAccountUrl(address, network)

  return (
    <div className="sol-wp">
      <div className="sol-wp__header">
        <h3 className="sol-wp__title">Solana Wallet</h3>
        <span className="sol-wp__badge sol-wp__badge--connected">Connected</span>
      </div>

      {/* Profile card */}
      <div className="sol-wp__profile-card">
        <div className="sol-wp__address-row">
          <span className="sol-wp__address">{shortenAddress(address, 6)}</span>
          <button className="sol-wp__copy-btn" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        {walletName && <div className="sol-wp__wallet-name">{walletName}</div>}
      </div>

      {/* Network selector */}
      <div className="sol-wp__network-select">
        {SOLANA_NETWORKS.map((net) => (
          <button
            key={net}
            className={`sol-wp__network-btn ${net === network ? 'sol-wp__network-btn--active' : ''}`}
            onClick={() => handleNetworkChange(net)}
          >
            {net}
          </button>
        ))}
      </div>

      {/* Balances */}
      <div className="sol-wp__balance-section">
        <h4 className="sol-wp__balance-title">Balances</h4>
        {loading ? (
          <div className="sol-wp__loading">Loading...</div>
        ) : (
          balances.map((b) => (
            <div key={b.mint} className="sol-wp__balance-item">
              <span className="sol-wp__balance-symbol">{b.symbol}</span>
              <span className="sol-wp__balance-amount">
                {formatLamports(b.balance, b.decimals)}
              </span>
            </div>
          ))
        )}
      </div>

      {error && <div className="sol-wp__error">{error}</div>}

      {/* Switch to another stored wallet */}
      {storedWallets.length > 1 && (
        <div className="sol-wp__switch">
          <button
            className="sol-wp__switch-btn"
            onClick={() => setShowStoredPicker(!showStoredPicker)}
          >
            Switch Wallet
          </button>
          {showStoredPicker && (
            <div className="sol-wp__stored-list">
              {storedWallets
                .filter((w) => w.address !== address)
                .map((w) => (
                  <button
                    key={w.address}
                    className="sol-wp__stored-item"
                    onClick={() => handleSelectStored(w)}
                  >
                    <span className="sol-wp__stored-addr">{shortenAddress(w.address, 6)}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Explorer link */}
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="sol-wp__explorer-link"
      >
        View on Solana Explorer
      </a>

      {/* Disconnect */}
      <button className="sol-wp__disconnect-btn" onClick={handleDisconnect}>
        Disconnect
      </button>

      <div className="sol-wp__footer">
        Solana {network} | Shared via <code>sharedData.{SOLANA_SHARED_KEY}</code>
      </div>
    </div>
  )
}

// --- Plugin Export ---
const SolanaWalletProfilePlugin: Plugin = {
  name: 'SolanaWalletProfile',
  version: '2.0.0',
  styleUrls: ['plugins/solana-wallet-profile/style.css'],

  init(host: HostAPI) {
    if (isSuiHostAPI(host)) {
      sharedHost = host as SuiHostAPI
    }
    host.registerComponent('SolanaWalletProfile', SolanaWalletProfileContent as never)
    host.log('[SolanaWalletProfile] Plugin initialized (Phantom + stored wallets)')
  },

  mount() {
    sharedHost?.log('[SolanaWalletProfile] Mounted')
  },

  unmount() {
    if (sharedHost) sharedHost.setSharedData(SOLANA_SHARED_KEY, null)
    sharedHost?.log('[SolanaWalletProfile] Unmounted')
  },
}

export default SolanaWalletProfilePlugin

// --- Solana Provider interface (Phantom-compatible) ---
interface SolanaProvider {
  isPhantom?: boolean
  isConnected?: boolean
  publicKey?: { toString: () => string }
  connect: () => Promise<{ publicKey: { toString: () => string } }>
  disconnect: () => Promise<void>
}
