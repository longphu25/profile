// SUI Wallet Profile Plugin — main entry
// Required plugin: other plugins depend on this for wallet context
// Connects wallet, resolves SuiNS, lists tokens, shares context via SuiHostAPI

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
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

import {
  GRPC_URLS,
  EXPLORER_URLS,
  SHARED_KEY,
  type Network,
  type TokenBalance,
  type WalletProfile,
} from './types'
import { ConnectPopup } from './ConnectPopup'
import { NetworkSelector } from './NetworkSelector'
import { ProfileHeader } from './ProfileHeader'
import { TokenList } from './TokenList'
import './style.css'

let sharedHost: SuiHostAPI | null = null

// Standalone DAppKit (only when NOT in sui-dashboard)
const standaloneDAppKit = createDAppKit({
  networks: ['mainnet', 'testnet', 'devnet'],
  defaultNetwork: 'mainnet',
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network as Network] }),
})

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof standaloneDAppKit
  }
}

// Known token decimals
const KNOWN_DECIMALS: Record<string, number> = {
  SUI: 9,
  USDC: 6,
  USDT: 6,
  WAL: 9,
  DEEP: 6,
  NS: 6,
  WUSDC: 6,
  WUSDT: 6,
}

function getDecimals(coinType: string): number {
  const symbol = coinType.split('::').pop() ?? ''
  return KNOWN_DECIMALS[symbol] ?? 9
}

// --- Core content (used in both modes) ---
function WalletProfileContent() {
  const wallets = useWallets()
  const connection = useWalletConnection()
  const account = useCurrentAccount()
  const network = useCurrentNetwork()
  const client = useCurrentClient()
  const dAppKit = useDAppKit()

  const [showPopup, setShowPopup] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [suinsName, setSuinsName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch balances + SuiNS
  const fetchProfile = useCallback(async () => {
    if (!account?.address || !client) return
    setLoading(true)
    setError(null)

    try {
      // Balances
      const { balances: raw } = await client.core.listBalances({ owner: account.address })
      const tokens: TokenBalance[] = raw
        .map((b) => {
          const symbol = b.coinType.split('::').pop() ?? 'Unknown'
          return {
            coinType: b.coinType,
            symbol,
            balance: b.balance,
            decimals: getDecimals(b.coinType),
          }
        })
        .sort((a, b) => {
          if (a.symbol === 'SUI') return -1
          if (b.symbol === 'SUI') return 1
          return Number(b.balance) - Number(a.balance)
        })
      setBalances(tokens)

      // SuiNS name
      try {
        const { data } = await client.core.defaultNameServiceName({ address: account.address })
        setSuinsName(data.name)
      } catch {
        setSuinsName(null)
      }

      // Share profile via host API
      if (sharedHost) {
        const profile: WalletProfile = {
          address: account.address,
          suinsName: suinsName,
          network: network as Network,
          balances: tokens,
        }
        sharedHost.setSharedData(SHARED_KEY, profile)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [account?.address, client, network, suinsName])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // Sync to SuiHostAPI context
  useEffect(() => {
    if (!sharedHost || !account?.address) return
    sharedHost.setSharedData(SHARED_KEY, {
      address: account.address,
      suinsName,
      network,
      balances,
    } satisfies WalletProfile)
  }, [account?.address, suinsName, network, balances])

  const handleConnect = async (wallet: { name: string }) => {
    setConnecting(true)
    setError(null)
    try {
      const w = wallets.find((w) => w.name === wallet.name)
      if (w) await dAppKit.connectWallet({ wallet: w })
      setShowPopup(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = () => {
    dAppKit.disconnectWallet()
    setBalances([])
    setSuinsName(null)
    if (sharedHost) sharedHost.setSharedData(SHARED_KEY, null)
  }

  const handleNetworkChange = (n: Network) => {
    dAppKit.switchNetwork(n)
    if (sharedHost) sharedHost.requestNetworkSwitch(n)
  }

  const explorerUrl = account?.address
    ? `${EXPLORER_URLS[network as Network] ?? EXPLORER_URLS.mainnet}/account/${account.address}`
    : null

  // Not connected
  if (!connection.isConnected) {
    return (
      <div className="swp">
        <div className="swp__header">
          <h3 className="swp__title">Wallet Profile</h3>
          <span className="swp__required-badge">Required</span>
        </div>
        <p className="swp__desc">Connect your wallet to enable all plugins</p>

        <NetworkSelector current={network as Network} onChange={handleNetworkChange} />

        <button className="swp__connect-btn" onClick={() => setShowPopup(true)}>
          Connect Wallet
        </button>

        {error && <div className="swp__error">{error}</div>}

        {showPopup && (
          <ConnectPopup
            wallets={wallets.map((w) => ({ name: w.name, icon: w.icon }))}
            onConnect={handleConnect}
            onClose={() => setShowPopup(false)}
            connecting={connecting}
          />
        )}
      </div>
    )
  }

  // Connected
  return (
    <div className="swp">
      <div className="swp__header">
        <h3 className="swp__title">Wallet Profile</h3>
        <span className="swp__connected-badge">Connected</span>
      </div>

      <ProfileHeader
        address={account!.address}
        suinsName={suinsName}
        walletName={connection.wallet?.name ?? 'Wallet'}
        walletIcon={connection.wallet?.icon}
        onDisconnect={handleDisconnect}
      />

      <NetworkSelector current={network as Network} onChange={handleNetworkChange} />

      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="swp__explorer-link"
        >
          View on Explorer ↗
        </a>
      )}

      {error && <div className="swp__error">{error}</div>}

      <TokenList balances={balances} loading={loading} />

      <div className="swp__footer">
        Wallet context shared with all plugins via <code>sharedData.{SHARED_KEY}</code>
      </div>
    </div>
  )
}

// Standalone wrapper — always provides its own DAppKitProvider
// Works in both WASM dashboard and plugin-demo pages
// Still uses sharedHost for cross-plugin data sharing when available
function WalletProfileStandalone() {
  return (
    <DAppKitProvider dAppKit={standaloneDAppKit}>
      <WalletProfileContent />
    </DAppKitProvider>
  )
}

const SuiWalletProfilePlugin: Plugin = {
  name: 'SuiWalletProfile',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-wallet-profile/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    // Always use standalone (own DAppKitProvider) since this plugin
    // manages the wallet connection itself. sharedHost is still set
    // for cross-plugin data sharing via setSharedData/getSharedData.
    host.registerComponent('SuiWalletProfile', WalletProfileStandalone)
    host.log(
      'SuiWalletProfile initialized' + (sharedHost ? ' (shared data enabled)' : ' (standalone)'),
    )
  },

  mount() {
    console.log('[SuiWalletProfile] mounted')
  },

  unmount() {
    if (sharedHost) sharedHost.setSharedData(SHARED_KEY, null)
    sharedHost = null
    console.log('[SuiWalletProfile] unmounted')
  },
}

export default SuiWalletProfilePlugin
