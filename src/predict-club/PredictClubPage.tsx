import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
}

const dAppKit = createDAppKit({
  networks: ['mainnet', 'testnet', 'devnet'],
  defaultNetwork: 'testnet',
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
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

const PLUGIN: PluginEntry = {
  id: 'predict-club',
  name: 'PredictClub',
  label: 'Predict Club',
  src: pluginPath('predict-club'),
  styleUrl: '/plugins/predict-club/style.css',
}

function PredictClubInner() {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWallets, setShowWallets] = useState(false)
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
      accounts: [],
    })
    suiHostAPI.setSharedData(
      'walletProfile',
      account?.address ? { address: account.address } : null,
    )
  }, [account?.address, network, connection.isConnected])

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
      const bustUrl = `${PLUGIN.src}${PLUGIN.src.includes('?') ? '&' : '?'}t=${Date.now()}`
      const module = await import(/* @vite-ignore */ bustUrl)
      const plugin = module.default
      if (!plugin?.name || !plugin?.init) throw new Error('Invalid plugin')
      plugin.init(suiHostAPI)
      plugin.mount?.()
      if (!suiHostAPI.getComponent(PLUGIN.name)) {
        throw new Error(`Component ${PLUGIN.name} not registered`)
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

  const Component = loaded ? suiHostAPI.getComponent(PLUGIN.name) : null

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
          <button className="predict-club-page__tool" type="button" aria-label="Wallet tools">
            <span className="material-symbols-outlined">account_balance_wallet</span>
          </button>
          <span className="predict-club-page__oracle" aria-label="Oracle health">
            <span className="material-symbols-outlined">sensors</span>
          </span>
          {connection.isConnected && account ? (
            <button
              type="button"
              className="predict-club-page__wallet predict-club-page__wallet--connected"
              onClick={() => dAppKitInstance.disconnectWallet()}
            >
              {account.address.slice(0, 6)}...{account.address.slice(-4)}
            </button>
          ) : (
            <button
              type="button"
              className="predict-club-page__wallet"
              onClick={() => setShowWallets(true)}
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

      {error && <div className="predict-club-page__error">{error}</div>}

      <main className="predict-club-page__workspace">
        {Component ? (
          <ShadowContainer styleUrls={[PLUGIN.styleUrl]}>
            <Component />
          </ShadowContainer>
        ) : (
          <div className="predict-club-page__loading">Loading {PLUGIN.label}...</div>
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
