// SUI Dual Wallet Plugin
// View 2 wallet addresses side by side — balances & transactions
// Slot A: connected wallet account (or manual address)
// Slot B: different account from same wallet, or any manual address
// Data shared via SuiHostAPI for cross-plugin access

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { createDAppKit } from '@mysten/dapp-kit-core'
import type { UiWallet, UiWalletAccount } from '@mysten/dapp-kit-core'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { useState, useEffect, useSyncExternalStore } from 'react'
import './style.css'

// --- Constants ---
const GRPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
}

const NETWORKS = ['mainnet', 'testnet', 'devnet'] as const
type Network = (typeof NETWORKS)[number]

const EXPLORER_BASE: Record<string, string> = {
  mainnet: 'https://suiscan.xyz/mainnet',
  testnet: 'https://suiscan.xyz/testnet',
  devnet: 'https://suiscan.xyz/devnet',
}

// --- Types ---
interface Balance {
  coinType: string
  symbol: string
  balance: string
}

interface Transaction {
  digest: string
  success: boolean
}

interface WalletData {
  address: string
  balances: Balance[]
  transactions: Transaction[]
}

const SHARED_KEY = 'dualWallet'

// --- Helpers ---
function formatBalance(balance: string, decimals = 9): string {
  const val = Number(balance) / Math.pow(10, decimals)
  if (val === 0) return '0'
  if (val < 0.0001) return '<0.0001'
  return val.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function shortenAddress(addr: string): string {
  if (addr.length <= 16) return addr
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`
}

function shortenDigest(digest: string): string {
  return `${digest.slice(0, 8)}...${digest.slice(-6)}`
}

function isValidSuiAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(addr)
}

// --- Single DAppKit for wallet connection ---
function createKit() {
  return createDAppKit({
    networks: ['mainnet', 'testnet', 'devnet'],
    defaultNetwork: 'mainnet',
    createClient: (network) => new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
    storageKey: 'sui-dual-wallet',
    autoConnect: true,
  })
}

type Kit = ReturnType<typeof createKit>
let kit: Kit | null = null
let sharedHost: SuiHostAPI | null = null

function getKit(): Kit {
  if (!kit) kit = createKit()
  return kit
}

// --- Hook: subscribe to nanostores ---
function useStore<T>(store: { subscribe: (cb: () => void) => () => void; get: () => T }): T {
  return useSyncExternalStore(store.subscribe, () => store.get())
}

// --- Fetch wallet data via RPC (no DAppKit needed) ---
async function fetchWalletData(
  address: string,
  network: string,
): Promise<{ balances: Balance[]; transactions: Transaction[] }> {
  const client = new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] })

  const { balances: raw } = await client.core.listBalances({ owner: address })
  const balances: Balance[] = raw.map((b) => {
    const parts = b.coinType.split('::')
    return {
      coinType: b.coinType,
      symbol: parts[parts.length - 1] || 'Unknown',
      balance: b.balance,
    }
  })
  balances.sort((a, b) => {
    if (a.symbol === 'SUI') return -1
    if (b.symbol === 'SUI') return 1
    return Number(b.balance) - Number(a.balance)
  })

  let transactions: Transaction[] = []
  try {
    const res = await fetch(
      `https://api.suiscan.xyz/api/v1/transactions?address=${address}&limit=5`,
    )
    if (res.ok) {
      const data = await res.json()
      transactions = (data.data || [])
        .slice(0, 5)
        .map((tx: { digest: string; status: string }) => ({
          digest: tx.digest,
          success: tx.status === 'success',
        }))
    }
  } catch {
    /* non-critical */
  }

  return { balances, transactions }
}

// --- Wallet data display (reused for both slots) ---
function WalletDataView({
  address,
  network,
  slotLabel,
}: {
  address: string
  network: string
  slotLabel: string
}) {
  const [balances, setBalances] = useState<Balance[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address || !isValidSuiAddress(address)) {
      setBalances([])
      setTransactions([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchWalletData(address, network)
      .then(({ balances: b, transactions: t }) => {
        if (cancelled) return
        setBalances(b)
        setTransactions(t)
        if (sharedHost) {
          sharedHost.setSharedData(`${SHARED_KEY}:${slotLabel}`, {
            address,
            balances: b,
            transactions: t,
          } as WalletData)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to fetch')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [address, network, slotLabel])

  if (!address || !isValidSuiAddress(address)) {
    return <div className="dual-wallet__muted">Enter a valid Sui address (0x...)</div>
  }

  if (error) return <div className="dual-wallet__error">{error}</div>
  if (loading) return <div className="dual-wallet__loading">Loading...</div>

  return (
    <>
      <div className="dual-wallet__section">
        <div className="dual-wallet__section-title">Balances</div>
        {balances.length === 0 ? (
          <div className="dual-wallet__muted">No tokens</div>
        ) : (
          <div className="dual-wallet__list">
            {balances.map((b) => (
              <div key={b.coinType} className="dual-wallet__row">
                <span>{b.symbol}</span>
                <span className="dual-wallet__amount">{formatBalance(b.balance)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="dual-wallet__section">
        <div className="dual-wallet__section-title">Recent Transactions</div>
        {transactions.length === 0 ? (
          <div className="dual-wallet__muted">No transactions</div>
        ) : (
          <div className="dual-wallet__list">
            {transactions.map((tx) => (
              <div key={tx.digest} className="dual-wallet__row">
                <a
                  href={`${EXPLORER_BASE[network] || EXPLORER_BASE.mainnet}/tx/${tx.digest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dual-wallet__tx-link"
                >
                  {shortenDigest(tx.digest)}
                </a>
                <span
                  className={`dual-wallet__status dual-wallet__status--${tx.success ? 'ok' : 'fail'}`}
                >
                  {tx.success ? '✓' : '✗'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// --- Main component ---
function DualWalletContent() {
  const k = getKit()
  const connection = useStore(k.stores.$connection)
  const network = useStore(k.stores.$currentNetwork)
  const wallets = useStore(k.stores.$wallets)

  const [showWallets, setShowWallets] = useState(false)
  const [connectedAccounts, setConnectedAccounts] = useState<UiWalletAccount[]>([])

  // Slot A: selected account from connected wallet
  const [slotAAddress, setSlotAAddress] = useState('')
  // Slot B: manual address input OR second account
  const [slotBAddress, setSlotBAddress] = useState('')
  const [slotBMode, setSlotBMode] = useState<'account' | 'manual'>('manual')

  // Sync connected account → slot A
  useEffect(() => {
    if (connection.isConnected && connection.account) {
      setSlotAAddress(connection.account.address)
    } else {
      setSlotAAddress('')
      setConnectedAccounts([])
    }
  }, [
    connection.isConnected,
    connection.status === 'connected' ? connection.account?.address : null,
  ])

  const handleConnect = async (wallet: UiWallet) => {
    try {
      const result = await k.connectWallet({ wallet })
      setConnectedAccounts(result.accounts || [])
      setShowWallets(false)
      // If wallet has multiple accounts, auto-suggest second for slot B
      if (result.accounts && result.accounts.length > 1) {
        setSlotBMode('account')
        setSlotBAddress(result.accounts[1].address)
      }
    } catch (err) {
      console.error('Connect failed:', err)
    }
  }

  const handleDisconnect = async () => {
    try {
      await k.disconnectWallet()
      setSlotAAddress('')
      setSlotBAddress('')
      setConnectedAccounts([])
      if (sharedHost) {
        sharedHost.setSharedData(`${SHARED_KEY}:Wallet A`, null)
        sharedHost.setSharedData(`${SHARED_KEY}:Wallet B`, null)
      }
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }

  const handleSwitchSlotA = (account: UiWalletAccount) => {
    k.switchAccount({ account })
    setSlotAAddress(account.address)
  }

  return (
    <div className="dual-wallet">
      {/* Header with network + wallet connect */}
      <div className="dual-wallet__header">
        <div className="dual-wallet__header-left">
          <h3 className="dual-wallet__title">Dual Wallet</h3>
          <span className="dual-wallet__hint">Compare 2 addresses side by side</span>
        </div>
        <div className="dual-wallet__header-right">
          <select
            className="dual-wallet__select"
            value={network}
            onChange={(e) => k.switchNetwork(e.target.value as Network)}
          >
            {NETWORKS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          {connection.isConnected ? (
            <button className="dual-wallet__disconnect-btn" onClick={handleDisconnect}>
              Disconnect {shortenAddress(connection.account?.address || '')}
            </button>
          ) : !showWallets ? (
            <button className="dual-wallet__connect-btn" onClick={() => setShowWallets(true)}>
              Connect Wallet
            </button>
          ) : (
            <div className="dual-wallet__wallet-dropdown">
              {wallets.length === 0 ? (
                <span className="dual-wallet__muted">No wallets</span>
              ) : (
                wallets.map((w) => (
                  <button
                    key={w.name}
                    className="dual-wallet__wallet-btn"
                    onClick={() => handleConnect(w)}
                  >
                    {w.icon && <img src={w.icon} alt="" className="dual-wallet__wallet-icon" />}
                    {w.name}
                  </button>
                ))
              )}
              <button className="dual-wallet__cancel-btn" onClick={() => setShowWallets(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Two-column grid */}
      <div className="dual-wallet__grid">
        {/* Slot A */}
        <div className="dual-wallet__slot">
          <div className="dual-wallet__slot-header">
            <span className="dual-wallet__slot-label">Wallet A</span>
          </div>

          {/* Account selector if multiple accounts */}
          {connectedAccounts.length > 1 ? (
            <div className="dual-wallet__account-select">
              <select
                className="dual-wallet__select dual-wallet__select--full"
                value={slotAAddress}
                onChange={(e) => {
                  const acc = connectedAccounts.find((a) => a.address === e.target.value)
                  if (acc) handleSwitchSlotA(acc)
                }}
              >
                {connectedAccounts.map((acc) => (
                  <option key={acc.address} value={acc.address}>
                    {shortenAddress(acc.address)}
                  </option>
                ))}
              </select>
            </div>
          ) : slotAAddress ? (
            <div className="dual-wallet__address">{shortenAddress(slotAAddress)}</div>
          ) : (
            <input
              className="dual-wallet__input"
              type="text"
              placeholder="Connect wallet or paste 0x address..."
              value={slotAAddress}
              onChange={(e) => setSlotAAddress(e.target.value.trim())}
            />
          )}

          <WalletDataView address={slotAAddress} network={network} slotLabel="Wallet A" />
        </div>

        {/* Slot B */}
        <div className="dual-wallet__slot">
          <div className="dual-wallet__slot-header">
            <span className="dual-wallet__slot-label">Wallet B</span>
            {connectedAccounts.length > 1 && (
              <div className="dual-wallet__mode-toggle">
                <button
                  className={`dual-wallet__mode-btn ${slotBMode === 'account' ? 'dual-wallet__mode-btn--active' : ''}`}
                  onClick={() => {
                    setSlotBMode('account')
                    if (connectedAccounts.length > 1) {
                      const other = connectedAccounts.find((a) => a.address !== slotAAddress)
                      if (other) setSlotBAddress(other.address)
                    }
                  }}
                >
                  Account
                </button>
                <button
                  className={`dual-wallet__mode-btn ${slotBMode === 'manual' ? 'dual-wallet__mode-btn--active' : ''}`}
                  onClick={() => {
                    setSlotBMode('manual')
                    setSlotBAddress('')
                  }}
                >
                  Manual
                </button>
              </div>
            )}
          </div>

          {slotBMode === 'account' && connectedAccounts.length > 1 ? (
            <div className="dual-wallet__account-select">
              <select
                className="dual-wallet__select dual-wallet__select--full"
                value={slotBAddress}
                onChange={(e) => setSlotBAddress(e.target.value)}
              >
                {connectedAccounts
                  .filter((a) => a.address !== slotAAddress)
                  .map((acc) => (
                    <option key={acc.address} value={acc.address}>
                      {shortenAddress(acc.address)}
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <input
              className="dual-wallet__input"
              type="text"
              placeholder="Paste any 0x address..."
              value={slotBAddress}
              onChange={(e) => setSlotBAddress(e.target.value.trim())}
            />
          )}

          <WalletDataView address={slotBAddress} network={network} slotLabel="Wallet B" />
        </div>
      </div>
    </div>
  )
}

const DualWalletPlugin: Plugin = {
  name: 'DualWallet',
  version: '1.1.0',
  styleUrls: ['/plugins/sui-dual-wallet/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('DualWallet', DualWalletContent)
    host.log(
      'DualWallet plugin initialized' + (sharedHost ? ' (shared mode)' : ' (standalone mode)'),
    )
  },

  mount() {
    console.log('[DualWallet] mounted')
  },

  unmount() {
    if (sharedHost) {
      sharedHost.setSharedData(`${SHARED_KEY}:Wallet A`, null)
      sharedHost.setSharedData(`${SHARED_KEY}:Wallet B`, null)
    }
    sharedHost = null
    kit = null
    console.log('[DualWallet] unmounted')
  },
}

export default DualWalletPlugin
