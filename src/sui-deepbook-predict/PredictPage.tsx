import { useState, useEffect, useRef, useCallback } from 'react'
import {
  DAppKitProvider,
  useDAppKit,
  useCurrentAccount,
  useCurrentNetwork,
  useWallets,
  useWalletConnection,
} from '@mysten/dapp-kit-react'
import { createDAppKit } from '@mysten/dapp-kit-core'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { suiHostAPI, registerActions, updateSuiContext } from '../sui-dashboard/sui-host'
import { ShadowContainer } from '../plugins/ShadowContainer'

// --- DAppKit instance ---
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

// --- Plugin config ---
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

const PLUGINS: PluginEntry[] = [
  {
    id: 'predict',
    name: 'SuiDeepBookPredict',
    label: 'Predict Market',
    src: pluginPath('sui-deepbook-predict'),
    styleUrl: '/plugins/sui-deepbook-predict/style.css',
  },
]

// --- Inner page (has access to DAppKit hooks) ---
function PredictInner() {
  const [loaded, setLoaded] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showWallets, setShowWallets] = useState(false)
  const initRef = useRef(false)

  const wallets = useWallets()
  const connection = useWalletConnection()
  const account = useCurrentAccount()
  const network = useCurrentNetwork()
  const dAppKitInstance = useDAppKit()

  // Sync DAppKit → suiHostAPI context
  useEffect(() => {
    updateSuiContext({
      address: account?.address ?? null,
      network,
      isConnected: connection.isConnected,
      accounts: [],
    })
  }, [account?.address, network, connection.isConnected])

  // Register wallet actions so plugins can call requestConnect, signAndExecuteTransaction, etc.
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

  // Connect wallet handler
  const handleConnect = async (wallet: (typeof wallets)[0]) => {
    try {
      await dAppKitInstance.connectWallet({ wallet })
      setShowWallets(false)
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        wallet: err instanceof Error ? err.message : 'Failed to connect',
      }))
    }
  }

  // Load plugin
  const loadPlugin = useCallback(async (p: PluginEntry) => {
    try {
      const bustUrl = `${p.src}${p.src.includes('?') ? '&' : '?'}t=${Date.now()}`
      const module = await import(/* @vite-ignore */ bustUrl)
      const plugin = module.default
      if (!plugin?.name || !plugin?.init) throw new Error('Invalid plugin')
      plugin.init(suiHostAPI)
      plugin.mount?.()
      if (!suiHostAPI.getComponent(p.name)) throw new Error(`Component ${p.name} not registered`)
      setLoaded((prev) => new Set(prev).add(p.id))
    } catch (err) {
      setErrors((prev) => ({ ...prev, [p.id]: err instanceof Error ? err.message : String(err) }))
    }
  }, [])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    PLUGINS.forEach(loadPlugin)
  }, [loadPlugin])

  return (
    <div className="min-h-screen flex flex-col bg-[#020617]">
      {/* Header */}
      <header className="border-b border-[#1e293b] px-4 py-2.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5 text-[#a855f7]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"
              />
            </svg>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-[#f8fafc]">
                DeepBook Predict
              </h1>
              <p className="text-[10px] text-[#64748b]">Prediction Market on Sui Testnet</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1e293b] px-2.5 py-1 text-[10px] text-[#a855f7]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a855f7] animate-pulse" />
              Testnet
            </span>
            {/* Wallet button */}
            {connection.isConnected && account ? (
              <button
                onClick={() => dAppKitInstance.disconnectWallet()}
                className="rounded-md bg-[#1e293b] px-3 py-1.5 text-[11px] text-[#f8fafc] hover:bg-[#334155] transition-colors cursor-pointer"
              >
                {account.address.slice(0, 6)}…{account.address.slice(-4)}
              </button>
            ) : (
              <button
                onClick={() => setShowWallets(true)}
                className="rounded-md bg-[#a855f7] px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-85 transition-opacity cursor-pointer"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Wallet picker overlay */}
      {showWallets && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowWallets(false)}
        >
          <div
            className="w-80 rounded-xl border border-[#1e293b] bg-[#0f172a] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-semibold text-[#f8fafc]">Connect Wallet</h3>
            {wallets.length === 0 ? (
              <p className="text-xs text-[#64748b]">
                No wallets detected. Install a Sui wallet extension.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {wallets.map((w) => (
                  <button
                    key={w.name}
                    onClick={() => handleConnect(w)}
                    className="flex items-center gap-3 rounded-lg border border-[#1e293b] bg-[#020617] px-4 py-3 text-left text-xs text-[#f8fafc] hover:border-[#a855f7] transition-colors cursor-pointer"
                  >
                    {w.icon && <img src={w.icon} alt="" className="h-6 w-6 rounded" />}
                    <span className="font-medium">{w.name}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowWallets(false)}
              className="mt-3 w-full rounded-md border border-[#1e293b] py-2 text-xs text-[#64748b] hover:text-[#f8fafc] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-7xl">
          {PLUGINS.map((p) => (
            <div key={p.id}>
              {errors[p.id] && (
                <div className="mb-3 rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-400">
                  {errors[p.id]}
                </div>
              )}
              {loaded.has(p.id) ? (
                <ShadowContainer styleUrls={[p.styleUrl]}>
                  {(() => {
                    const C = suiHostAPI.getComponent(p.name)
                    return C ? <C /> : null
                  })()}
                </ShadowContainer>
              ) : !errors[p.id] ? (
                <div className="text-center text-[#64748b] py-12 text-xs">Loading {p.label}…</div>
              ) : null}
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e293b] px-4 py-2 text-center text-[10px] text-[#475569]">
        DeepBook Predict — Testnet Integration · Data from predict-server.testnet.mystenlabs.com
      </footer>
    </div>
  )
}

// --- Exported page component (wraps with DAppKitProvider) ---
export function PredictPage() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <PredictInner />
    </DAppKitProvider>
  )
}
