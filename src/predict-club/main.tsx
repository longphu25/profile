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

/** Slot ID → Plugin component name mapping */
const SLOT_MAP: Array<[string, string]> = [
  ['pc-slot-decision-strip', 'PredictClub.DecisionStrip'],
  ['pc-slot-club-panel', 'PredictClub.ClubPanel'],
  ['pc-slot-prediction-room', 'PredictClub.PredictionRoom'],
  ['pc-slot-risk-panel', 'PredictClub.RiskPanel'],
  ['pc-slot-funding-router', 'PredictClub.FundingRouter'],
  ['pc-slot-escrow-offers', 'PredictClub.EscrowOffers'],
  ['pc-slot-round-history', 'PredictClub.RoundHistory'],
  ['pc-slot-modal-layer', 'PredictClub.ModalLayer'],
]

const pluginPath = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}plugins/predict-club/plugin.tsx`
  : `${import.meta.env.BASE_URL}assets/plugins/predict-club.js`

/**
 * Multi-slot mounting orchestrator.
 * Detects available slot containers in the HTML and mounts the corresponding
 * React panel component into each one.
 */
function PredictClubOrchestrator() {
  const [, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      accounts: [],
    })
    suiHostAPI.setSharedData(
      'walletProfile',
      account?.address ? { address: account.address } : null,
    )
  }, [account?.address, network, connection.isConnected])

  // Register wallet actions
  useEffect(() => {
    registerActions({
      onConnect: () => {
        // Wallet connect handled by HTML page button or can be triggered
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

  // Load plugin and mount panels into slots
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function loadAndMount() {
      try {
        const bustUrl = `${pluginPath}${pluginPath.includes('?') ? '&' : '?'}t=${Date.now()}`
        const module = await import(/* @vite-ignore */ bustUrl)
        const plugin = module.default
        if (!plugin?.name || !plugin?.init) throw new Error('Invalid plugin')

        plugin.init(suiHostAPI)
        plugin.mount?.()

        // Mount each panel into its slot
        for (const [slotId, componentName] of SLOT_MAP) {
          const container = document.getElementById(slotId)
          if (!container) continue

          const Component = suiHostAPI.getComponent(componentName) as
            | ComponentType<unknown>
            | undefined
          if (!Component) continue

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
    } else {
      btn.textContent = 'Connect Wallet'
      btn.classList.remove('connected')
    }
  }, [connection.isConnected, account])

  if (error) {
    console.error('[PredictClub] Mount error:', error)
  }

  // This orchestrator renders nothing visible itself
  return null
}

/**
 * Bootstrap: render the invisible orchestrator into a hidden root.
 * It handles plugin loading, wallet sync, and panel mounting.
 */
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
