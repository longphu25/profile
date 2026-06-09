import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import {
  DAppKitProvider,
  useCurrentAccount,
  useCurrentNetwork,
  useDAppKit,
  useWalletConnection,
  useWallets,
} from '@mysten/dapp-kit-react'
import { createDAppKit } from '@mysten/dapp-kit-core'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { ShadowContainer } from '../plugins/ShadowContainer'
import { suiHostAPI, registerActions, updateSuiContext } from '../sui-dashboard/sui-host'

const GRPC_URLS: Record<string, string> = {
  mainnet: 'https://sui-mainnet.mystenlabs.com',
  testnet: 'https://sui-testnet.mystenlabs.com',
  devnet: 'https://sui-devnet.mystenlabs.com',
}

const dAppKit = createDAppKit({
  networks: ['mainnet', 'testnet', 'devnet'],
  defaultNetwork: 'testnet',
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
  slushWalletConfig: null,
})

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit
  }
}

interface PluginEntry {
  id: string
  name: string
  label: string
  src: string
  styleUrl: string
}

const pluginPath = (name: string) =>
  import.meta.env.DEV
    ? `${import.meta.env.BASE_URL}plugins/${name}/plugin.tsx`
    : `${import.meta.env.BASE_URL}assets/plugins/${name}.js`

const PREDICT_PLUGIN: PluginEntry = {
  id: 'predict-club',
  name: 'PredictClub',
  label: 'Predict Club',
  src: pluginPath('predict-club'),
  styleUrl: '/plugins/predict-club/style.css',
}

const SCALLOP_PLUGIN: PluginEntry = {
  id: 'sui-scallop',
  name: 'SuiScallop',
  label: 'Scallop Borrow',
  src: pluginPath('sui-scallop'),
  styleUrl: '/plugins/sui-scallop/style.css',
}

const WALLET_PLUGIN: PluginEntry = {
  id: 'sui-wallet-profile',
  name: 'SuiWalletProfile',
  label: 'Sui Wallet Profile',
  src: pluginPath('sui-wallet-profile'),
  styleUrl: '/plugins/sui-wallet-profile/style.css',
}

function PredictClubInner() {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWallets, setShowWallets] = useState(false)
  const [showWalletProfile, setShowWalletProfile] = useState(false)
  const initRef = useRef(false)

  const wallets = useWallets()
  const connection = useWalletConnection()
  const account = useCurrentAccount()
  const network = useCurrentNetwork()
  const dAppKitInstance = useDAppKit()

  useEffect(() => {
    updateSuiContext({
      address: account?.address ?? null,
      network,
      isConnected: connection.isConnected,
      accounts: account
        ? [
            {
              address: account.address,
              walletName: connection.wallet?.name ?? 'Wallet',
              walletIcon: connection.wallet?.icon,
            },
          ]
        : [],
    })
    suiHostAPI.setSharedData(
      'walletProfile',
      account?.address
        ? {
            address: account.address,
            network,
            walletName: connection.wallet?.name,
            walletIcon: connection.wallet?.icon,
          }
        : null,
    )
  }, [account?.address, network, connection.isConnected, connection.wallet?.name, connection.wallet?.icon])

  useEffect(() => {
    registerActions({
      onConnect: () => setShowWallets(true),
      onDisconnect: () => dAppKitInstance.disconnectWallet(),
      onNetworkSwitch: (net) =>
        dAppKitInstance.switchNetwork(net as 'mainnet' | 'testnet' | 'devnet'),
      onSignAndExecuteTransaction: async (transaction) => {
        const result = await dAppKitInstance.signAndExecuteTransaction({ transaction })
        const tx = result.Transaction ?? result.FailedTransaction
        if (result.$kind === 'FailedTransaction') {
          throw new Error(`Transaction failed: ${tx?.digest}`)
        }
        return { digest: tx!.digest, effects: tx }
      },
      onSignPersonalMessage: async (message) => {
        const result = await dAppKitInstance.signPersonalMessage({ message })
        return { signature: result.signature, bytes: result.bytes }
      },
    })
  }, [dAppKitInstance])

  const loadPlugin = useCallback(async () => {
    try {
      for (const entry of [WALLET_PLUGIN, SCALLOP_PLUGIN, PREDICT_PLUGIN]) {
        const bustUrl = `${entry.src}${entry.src.includes('?') ? '&' : '?'}t=${Date.now()}`
        const module = await import(/* @vite-ignore */ bustUrl)
        const plugin = module.default
        if (!plugin?.name || !plugin?.init) throw new Error(`Invalid plugin: ${entry.id}`)
        plugin.init(suiHostAPI)
        plugin.mount?.()
        // Scallop registers sub-components (ScallopBorrow), not a top-level component
        if (entry.id !== 'sui-scallop' && !suiHostAPI.getComponent(entry.name)) {
          throw new Error(`Component ${entry.name} not registered`)
        }
        // Inject plugin CSS into light DOM for overlay/popup components
        if (entry.styleUrl && !document.querySelector(`link[href*="${entry.id}"]`)) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = entry.styleUrl
          document.head.appendChild(link)
        }
      }
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    loadPlugin()
  }, [loadPlugin])

  const balances = useMemo(
    () => [
      { symbol: 'SUI', value: '1,240.50' },
      { symbol: 'USDC', value: '5,000.00' },
      { symbol: 'DUSDC', value: '2,500.00' },
    ],
    [],
  )

  const handleConnect = async (wallet: (typeof wallets)[0]) => {
    try {
      await dAppKitInstance.connectWallet({ wallet })
      setShowWallets(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
    }
  }

  const Component = loaded ? suiHostAPI.getComponent(PREDICT_PLUGIN.name) : null
  const WalletProfilePopup = loaded
    ? (suiHostAPI.getComponent('SuiWalletProfile.Popup') as
        | ComponentType<{ open: boolean; onClose: () => void }>
        | undefined)
    : null

  const openWalletControl = () => {
    if (connection.isConnected) setShowWalletProfile(true)
    else setShowWallets(true)
  }

  return (
    <div className="predict-club-page">
      <header className="predict-club-page__topbar">
        <div className="predict-club-page__brand">
          <strong>PREDICT CLUB</strong>
          <nav className="predict-club-page__nav" aria-label="Predict Club navigation">
            <a className="predict-club-page__nav-active" href="#clubs">Clubs</a>
            <a href="#market">Market</a>
            <a href="#history">History</a>
            <a href="#leaderboard">Leaderboard</a>
          </nav>
        </div>
        <div className="predict-club-page__top-actions">
          <div className="predict-club-page__balances" aria-label="wallet balances">
            {balances.map((balance) => (
              <span key={balance.symbol}>
                {balance.symbol}: <b>{balance.value}</b>
              </span>
            ))}
          </div>
          <button
            className="predict-club-page__tool"
            type="button"
            aria-label="Wallet tools"
            onClick={openWalletControl}
          >
            <span className="material-symbols-outlined">account_balance_wallet</span>
          </button>
          <span className="predict-club-page__oracle" aria-label="Oracle health">
            <span className="material-symbols-outlined">sensors</span>
          </span>
          {connection.isConnected && account ? (
            <button
              type="button"
              className="predict-club-page__wallet predict-club-page__wallet--connected"
              onClick={openWalletControl}
            >
              {account.address.slice(0, 6)}...{account.address.slice(-4)}
            </button>
          ) : (
            <button
              type="button"
              className="predict-club-page__wallet"
              onClick={openWalletControl}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {showWallets && (
        <div className="predict-club-page__overlay" onClick={() => setShowWallets(false)}>
          <section className="predict-club-page__wallet-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Connect Wallet</h2>
            {wallets.length === 0 ? (
              <p>No Sui wallet extension was detected.</p>
            ) : (
              wallets.map((wallet) => (
                <button key={wallet.name} type="button" onClick={() => handleConnect(wallet)}>
                  {wallet.icon && <img src={wallet.icon} alt="" />}
                  <span>{wallet.name}</span>
                </button>
              ))
            )}
            <button
              type="button"
              className="predict-club-page__ghost"
              onClick={() => setShowWallets(false)}
            >
              Cancel
            </button>
          </section>
        </div>
      )}

      {WalletProfilePopup ? (
        <WalletProfilePopup open={showWalletProfile} onClose={() => setShowWalletProfile(false)} />
      ) : null}

      {error && <div className="predict-club-page__error">{error}</div>}

      <main className="predict-club-page__workspace">
        {Component ? (
          <ShadowContainer styleUrls={[PREDICT_PLUGIN.styleUrl]}>
            <Component />
          </ShadowContainer>
        ) : (
          <div className="predict-club-page__loading">Loading {PREDICT_PLUGIN.label}...</div>
        )}
      </main>
    </div>
  )
}

export function PredictClubPage() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <PredictClubInner />
    </DAppKitProvider>
  )
}
