import '../dev'
import { StrictMode, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createPortal } from 'react-dom'
import {
  DAppKitProvider,
  useCurrentAccount,
  useCurrentNetwork,
  useDAppKit,
  useWalletConnection,
  useWallets,
} from '@mysten/dapp-kit-react'
import { createDAppKit, type DefaultExpectedDppKit } from '@mysten/dapp-kit-core'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc'
import { suiHostAPI, registerActions, updateSuiContext } from '../sui-dashboard/sui-host'
import { useEffect, useRef, useState } from 'react'
import '../predict-club/predict-club.css'

type SuiNetwork = 'mainnet' | 'testnet' | 'devnet'
const createSuiClient = (network: SuiNetwork) =>
  import.meta.env.DEV
    ? new SuiGrpcClient({ network, baseUrl: `/sui-rpc/${network}` })
    : new SuiJsonRpcClient({ network, url: getJsonRpcFullnodeUrl(network) })

const dAppKit = createDAppKit({
  networks: ['mainnet', 'testnet', 'devnet'],
  defaultNetwork: 'testnet',
  createClient: createSuiClient,
  slushWalletConfig: null,
})

const pluginPath = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}plugins/predict-club/plugin.tsx`
  : `${import.meta.env.BASE_URL}assets/plugins/predict-club.js`

const walletPluginPath = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}plugins/sui-wallet-profile/plugin.tsx`
  : `${import.meta.env.BASE_URL}assets/plugins/sui-wallet-profile.js`

/**
 * Redesigned (Next) orchestrator. Loads the same predict-club plugin and mounts
 * the React-owned `PredictClub.Next.Shell` into the `#pc-next-root` slot. Wallet
 * wiring mirrors `src/predict-club/main.tsx`; the data layer is shared, so this
 * surface never forks context or domain logic.
 */
export function PredictClubNextOrchestrator() {
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

  // Load plugin and mount the Next shell into its root slot
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function loadAndMount() {
      try {
        const walletBustUrl = `${walletPluginPath}${walletPluginPath.includes('?') ? '&' : '?'}t=${Date.now()}`
        const walletModule = await import(/* @vite-ignore */ walletBustUrl)
        const walletPlugin = walletModule.default
        if (walletPlugin?.name && walletPlugin?.init) {
          walletPlugin.init(suiHostAPI)
          walletPlugin.mount?.()
          const EmbeddedWalletProfile = suiHostAPI.getComponent('SuiWalletProfile.Popup') as
            | ComponentType<{ open: boolean; onClose: () => void }>
            | undefined
          if (EmbeddedWalletProfile) {
            setWalletProfilePopup(() => EmbeddedWalletProfile)
          }
        }

        const bustUrl = `${pluginPath}${pluginPath.includes('?') ? '&' : '?'}t=${Date.now()}`
        const module = await import(/* @vite-ignore */ bustUrl)
        const plugin = module.default
        if (!plugin?.name || !plugin?.init) throw new Error('Invalid plugin')

        plugin.init(suiHostAPI)
        plugin.mount?.()

        const container = document.getElementById('pc-next-root')
        const Shell = suiHostAPI.getComponent('PredictClub.Next.Cockpit') as
          | ComponentType<unknown>
          | undefined
        if (container && Shell) {
          container.innerHTML = ''
          const root = createRoot(container)
          root.render(
            <StrictMode>
              <DAppKitProvider dAppKit={dAppKit as unknown as DefaultExpectedDppKit}>
                <Shell />
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

  // Reflect connection state on the static wallet button in the HTML nav
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
  }, [connection.isConnected, account?.address])

  useEffect(() => {
    const controls = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-wallet-trigger], [data-wallet-btn]'),
    )
    if (!controls.length) return undefined

    const handleClick = () => {
      if (connection.isConnected) {
        setShowWalletProfile(true)
      } else if (wallets.length > 0) {
        dAppKitInstance.connectWallet({ wallet: wallets[0] })
      }
    }

    controls.forEach((control) => control.addEventListener('click', handleClick))
    return () => controls.forEach((control) => control.removeEventListener('click', handleClick))
  }, [connection.isConnected, dAppKitInstance, wallets])

  if (error) {
    console.error('[PredictClubNext] Mount error:', error)
  }

  return WalletProfilePopup && showWalletProfile
    ? createPortal(
        <WalletProfilePopup open={true} onClose={() => setShowWalletProfile(false)} />,
        document.body,
      )
    : null
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
    <DAppKitProvider dAppKit={dAppKit as unknown as DefaultExpectedDppKit}>
      <PredictClubNextOrchestrator />
    </DAppKitProvider>
  </StrictMode>,
)
