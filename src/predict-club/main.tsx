import { StrictMode, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
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
import { suiHostAPI, registerActions, updateSuiContext } from '../sui-dashboard/sui-host'
import { useEffect, useRef, useState } from 'react'
import './predict-club.css'

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

/**
 * Panel name → data-pc-panel attribute value + plugin component name.
 * The orchestrator finds each [data-pc-panel="X"] in the DOM,
 * replaces its inner static content with a React root.
 */
const PANEL_MAP: Array<[string, string]> = [
  ['decision-strip', 'PredictClub.DecisionStrip'],
  ['club-panel', 'PredictClub.ClubPanel'],
  ['prediction-room', 'PredictClub.PredictionRoom'],
  ['risk-panel', 'PredictClub.RiskPanel'],
  ['funding-router', 'PredictClub.FundingRouter'],
  ['escrow-offers', 'PredictClub.EscrowOffers'],
  ['round-history', 'PredictClub.RoundHistory'],
]

const pluginPath = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}plugins/predict-club/plugin.tsx`
  : `${import.meta.env.BASE_URL}assets/plugins/predict-club.js`

const walletPluginPath = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}plugins/sui-wallet-profile/plugin.tsx`
  : `${import.meta.env.BASE_URL}assets/plugins/sui-wallet-profile.js`

/**
 * Interactive mode orchestrator.
 * Loads the plugin, then replaces static HTML content inside each
 * [data-pc-panel] container with a live React panel component.
 */
export function PredictClubOrchestrator() {
  const [, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWalletProfile, setShowWalletProfile] = useState(false)
  const [WalletProfilePopup, setWalletProfilePopup] = useState<ComponentType<{
    open: boolean
    onClose: () => void
  }> | null>(null)
  const rootsRef = useRef<Root[]>([])
  const initRef = useRef(false)

  const wallets = useWallets()
  const connection = useWalletConnection()
  const account = useCurrentAccount()
  const network = useCurrentNetwork()
  const dAppKitInstance = useDAppKit()

  // Sync wallet context to host
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
  }, [
    account?.address,
    network,
    connection.isConnected,
    connection.wallet?.name,
    connection.wallet?.icon,
  ])

  // Register wallet actions
  useEffect(() => {
    registerActions({
      onConnect: () => {
        if (wallets.length > 0) {
          dAppKitInstance.connectWallet({ wallet: wallets[0] })
        }
      },
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
  }, [dAppKitInstance, wallets])

  // Load plugin and mount panels into layout containers
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function loadAndMount() {
      try {
        const walletBustUrl = `${walletPluginPath}${walletPluginPath.includes('?') ? '&' : '?'}t=${Date.now()}`
        const walletModule = await import(/* @vite-ignore */ walletBustUrl)
        const walletPlugin = walletModule.default
        if (!walletPlugin?.name || !walletPlugin?.init) {
          throw new Error('Invalid wallet profile plugin')
        }
        walletPlugin.init(suiHostAPI)
        walletPlugin.mount?.()
        const EmbeddedWalletProfile = suiHostAPI.getComponent('SuiWalletProfile.Popup') as
          | ComponentType<{ open: boolean; onClose: () => void }>
          | undefined
        if (EmbeddedWalletProfile) {
          setWalletProfilePopup(() => EmbeddedWalletProfile)
        }

        const bustUrl = `${pluginPath}${pluginPath.includes('?') ? '&' : '?'}t=${Date.now()}`
        const module = await import(/* @vite-ignore */ bustUrl)
        const plugin = module.default
        if (!plugin?.name || !plugin?.init) throw new Error('Invalid plugin')

        plugin.init(suiHostAPI)
        plugin.mount?.()

        // Mount each panel into its [data-pc-panel] container
        for (const [panelName, componentName] of PANEL_MAP) {
          const container = document.querySelector(
            `[data-pc-panel="${panelName}"]`,
          ) as HTMLElement | null
          if (!container) continue

          const Component = suiHostAPI.getComponent(componentName) as
            | ComponentType<unknown>
            | undefined
          if (!Component) continue

          // Clear static HTML content (replaced by React)
          container.innerHTML = ''

          const root = createRoot(container)
          root.render(
            <StrictMode>
              <DAppKitProvider dAppKit={dAppKit}>
                <Component />
              </DAppKitProvider>
            </StrictMode>,
          )
          rootsRef.current.push(root)
        }

        // Mount modal layer into its dedicated slot
        const modalSlot = document.getElementById('pc-slot-modal-layer')
        const ModalComponent = suiHostAPI.getComponent('PredictClub.ModalLayer') as
          | ComponentType<unknown>
          | undefined
        if (modalSlot && ModalComponent) {
          const root = createRoot(modalSlot)
          root.render(
            <StrictMode>
              <DAppKitProvider dAppKit={dAppKit}>
                <ModalComponent />
              </DAppKitProvider>
            </StrictMode>,
          )
          rootsRef.current.push(root)
        }

        setReady(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    loadAndMount()

    return () => {
      rootsRef.current.forEach((root) => root.unmount())
      rootsRef.current = []
    }
  }, [])

  // Update wallet button in HTML based on connection state
  useEffect(() => {
    const btn = document.querySelector('[data-wallet-btn]') as HTMLButtonElement | null
    if (!btn) return
    if (connection.isConnected && account) {
      btn.textContent = `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
      btn.classList.add('connected')
      btn.setAttribute('title', 'Open wallet profile')
    } else {
      btn.textContent = 'Connect Wallet'
      btn.classList.remove('connected')
      btn.setAttribute('title', 'Connect wallet')
    }
  }, [connection.isConnected, account])

  useEffect(() => {
    const btn = document.querySelector('[data-wallet-btn]') as HTMLButtonElement | null
    if (!btn) return undefined

    const handleClick = () => {
      if (connection.isConnected) {
        setShowWalletProfile(true)
      } else if (wallets.length > 0) {
        dAppKitInstance.connectWallet({ wallet: wallets[0] })
      }
    }

    btn.addEventListener('click', handleClick)
    return () => btn.removeEventListener('click', handleClick)
  }, [connection.isConnected, dAppKitInstance, wallets])

  if (error) {
    console.error('[PredictClub] Mount error:', error)
  }

  return WalletProfilePopup ? (
    <WalletProfilePopup open={showWalletProfile} onClose={() => setShowWalletProfile(false)} />
  ) : null
}

// Bootstrap: render orchestrator into hidden root
const rootEl = document.getElementById('root') || document.createElement('div')
if (!rootEl.id) {
  rootEl.id = 'root'
  rootEl.style.display = 'none'
  document.body.appendChild(rootEl)
}

createRoot(rootEl).render(
  <StrictMode>
    <DAppKitProvider dAppKit={dAppKit}>
      <PredictClubOrchestrator />
    </DAppKitProvider>
  </StrictMode>,
)
