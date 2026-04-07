// SUI Wallet Plugin
// Connect wallet, show balances and transaction history with explorer links

import type { Plugin, HostAPI } from '../../src/plugins/types'
import {
  DAppKitProvider,
  useDAppKit,
  useCurrentAccount,
  useCurrentNetwork,
  useCurrentClient,
  useWallets,
  useWalletConnection,
} from '@mysten/dapp-kit-react'
import { createDAppKit } from '@mysten/dapp-kit-core'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { useState, useEffect } from 'react'
import './style.css'

const GRPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
}

const EXPLORER_URLS = {
  suiscan: {
    mainnet: 'https://suiscan.xyz/mainnet',
    testnet: 'https://suiscan.xyz/testnet',
    devnet: 'https://suiscan.xyz/devnet',
  },
  suivision: {
    mainnet: 'https://suivision.xyz',
    testnet: 'https://testnet.suivision.xyz',
    devnet: 'https://devnet.suivision.xyz',
  },
}

// Create dAppKit instance
const dAppKit = createDAppKit({
  networks: ['mainnet', 'testnet', 'devnet'],
  defaultNetwork: 'mainnet',
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
})

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit
  }
}

interface Balance {
  coinType: string
  symbol: string
  balance: string
}

interface Transaction {
  digest: string
  success: boolean
}

function formatBalance(balance: string, decimals = 9): string {
  const val = Number(balance) / Math.pow(10, decimals)
  if (val === 0) return '0'
  if (val < 0.0001) return '<0.0001'
  return val.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function shortenDigest(digest: string): string {
  return `${digest.slice(0, 8)}...${digest.slice(-6)}`
}

function getExplorerTxUrl(
  network: string,
  digest: string,
  explorer: 'suiscan' | 'suivision',
): string {
  const baseUrl =
    EXPLORER_URLS[explorer][network as keyof typeof EXPLORER_URLS.suiscan] ||
    EXPLORER_URLS[explorer].mainnet
  return `${baseUrl}/tx/${digest}`
}

const NETWORKS = ['mainnet', 'testnet', 'devnet'] as const
type Network = (typeof NETWORKS)[number]

function WalletContent() {
  const wallets = useWallets()
  const connection = useWalletConnection()
  const account = useCurrentAccount()
  const network = useCurrentNetwork()
  const client = useCurrentClient()
  const dAppKitInstance = useDAppKit()

  const [balances, setBalances] = useState<Balance[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWallets, setShowWallets] = useState(false)

  const handleNetworkChange = (newNetwork: Network) => {
    dAppKitInstance.switchNetwork(newNetwork)
  }

  useEffect(() => {
    if (!account?.address || !client) {
      setBalances([])
      setTransactions([])
      return
    }

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Fetch balances
        const { balances: balanceList } = await client.core.listBalances({
          owner: account.address,
        })

        const formattedBalances: Balance[] = balanceList.map((b) => {
          const parts = b.coinType.split('::')
          const symbol = parts[parts.length - 1] || 'Unknown'
          return {
            coinType: b.coinType,
            symbol,
            balance: b.balance,
          }
        })

        // Sort SUI first, then by balance
        formattedBalances.sort((a, b) => {
          if (a.symbol === 'SUI') return -1
          if (b.symbol === 'SUI') return 1
          return Number(b.balance) - Number(a.balance)
        })

        setBalances(formattedBalances)

        // Fetch recent transactions using SuiScan API
        try {
          const txResponse = await fetch(
            `https://api.suiscan.xyz/api/v1/transactions?address=${account.address}&limit=5`,
          )

          if (txResponse.ok) {
            const txData = await txResponse.json()
            const txs: Transaction[] = (txData.data || [])
              .slice(0, 5)
              .map((tx: { digest: string; status: string }) => ({
                digest: tx.digest,
                success: tx.status === 'success',
              }))
            setTransactions(txs)
          }
        } catch {
          // Silently fail for tx history - not critical
          setTransactions([])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [account?.address, client, network])

  const handleConnect = async (wallet: (typeof wallets)[0]) => {
    try {
      await dAppKitInstance.connectWallet({ wallet })
      setShowWallets(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    }
  }

  const handleDisconnect = async () => {
    try {
      await dAppKitInstance.disconnectWallet()
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }

  // Not connected - show connect UI
  if (!connection.isConnected) {
    return (
      <div className="sui-wallet">
        <div className="sui-wallet__header">
          <h3 className="sui-wallet__title">💼 SUI Wallet</h3>
          <select
            className="sui-wallet__network-select"
            value={network}
            onChange={(e) => handleNetworkChange(e.target.value as Network)}
          >
            {NETWORKS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Connect your wallet to view balances and transactions.
        </p>

        {!showWallets ? (
          <button
            className="sui-wallet__connect-btn"
            onClick={() => setShowWallets(true)}
            disabled={connection.isConnecting}
          >
            {connection.isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : (
          <div className="sui-wallet__wallets">
            {wallets.length === 0 ? (
              <div className="sui-wallet__empty">
                No wallets detected. Please install a SUI wallet.
              </div>
            ) : (
              wallets.map((wallet) => (
                <button
                  key={wallet.name}
                  className="sui-wallet__wallet-btn"
                  onClick={() => handleConnect(wallet)}
                >
                  {wallet.icon && (
                    <img src={wallet.icon} alt="" className="sui-wallet__wallet-icon" />
                  )}
                  {wallet.name}
                </button>
              ))
            )}
            <button
              className="sui-wallet__disconnect-btn"
              onClick={() => setShowWallets(false)}
              style={{ marginTop: '0.5rem' }}
            >
              Cancel
            </button>
          </div>
        )}

        {error && <div className="sui-wallet__error">{error}</div>}
      </div>
    )
  }

  // Connected - show wallet info
  return (
    <div className="sui-wallet">
      <div className="sui-wallet__header">
        <h3 className="sui-wallet__title">💼 SUI Wallet</h3>
        <div className="sui-wallet__header-actions">
          <select
            className="sui-wallet__network-select"
            value={network}
            onChange={(e) => handleNetworkChange(e.target.value as Network)}
          >
            {NETWORKS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button className="sui-wallet__disconnect-btn" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      </div>

      <div className="sui-wallet__address">{account?.address}</div>

      {error && <div className="sui-wallet__error">{error}</div>}

      {loading ? (
        <div className="sui-wallet__loading">Loading...</div>
      ) : (
        <>
          <div className="sui-wallet__section">
            <div className="sui-wallet__section-title">Balances</div>
            {balances.length === 0 ? (
              <div className="sui-wallet__empty">No tokens found</div>
            ) : (
              <div className="sui-wallet__balances">
                {balances.map((b) => (
                  <div key={b.coinType} className="sui-wallet__balance-item">
                    <span className="sui-wallet__token-name">{b.symbol}</span>
                    <span className="sui-wallet__token-amount">{formatBalance(b.balance)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sui-wallet__section">
            <div className="sui-wallet__section-title">Recent Transactions</div>
            {transactions.length === 0 ? (
              <div className="sui-wallet__empty">No transactions found</div>
            ) : (
              <div className="sui-wallet__txs">
                {transactions.map((tx) => (
                  <div key={tx.digest} className="sui-wallet__tx-item">
                    <span className="sui-wallet__tx-digest">{shortenDigest(tx.digest)}</span>
                    <span
                      className={`sui-wallet__tx-status sui-wallet__tx-status--${
                        tx.success ? 'success' : 'failure'
                      }`}
                    >
                      {tx.success ? 'Success' : 'Failed'}
                    </span>
                    <div className="sui-wallet__tx-links">
                      <a
                        href={getExplorerTxUrl(network, tx.digest, 'suiscan')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sui-wallet__tx-link"
                        title="View on SuiScan"
                      >
                        <img src="https://suiscan.xyz/favicon.ico" alt="SuiScan" />
                      </a>
                      <a
                        href={getExplorerTxUrl(network, tx.digest, 'suivision')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sui-wallet__tx-link"
                        title="View on SuiVision"
                      >
                        <img src="https://suivision.xyz/favicon.ico" alt="SuiVision" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SuiWalletComponent() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <WalletContent />
    </DAppKitProvider>
  )
}

const SuiWalletPlugin: Plugin = {
  name: 'SuiWallet',
  version: '1.0.0',

  init(host: HostAPI) {
    host.registerComponent('SuiWallet', SuiWalletComponent)
    host.log('SuiWallet plugin initialized')
  },

  mount() {
    console.log('[SuiWallet] mounted')
  },

  unmount() {
    console.log('[SuiWallet] unmounted')
  },
}

export default SuiWalletPlugin
