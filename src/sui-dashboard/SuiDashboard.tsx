import { useState, useCallback, useEffect } from 'react'
import {
  DAppKitProvider,
  useDAppKit,
  useCurrentAccount,
  useCurrentNetwork,
  useWallets,
  useWalletConnection,
} from '@mysten/dapp-kit-react'
import { createDAppKit } from '@mysten/dapp-kit-core'
import type { UiWalletAccount } from '@mysten/dapp-kit-core'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import {
  suiHostAPI,
  getRegisteredSuiComponents,
  unregisterSuiComponent,
  registerActions,
  updateSuiContext,
} from './sui-host'
import { loadSuiPlugin } from './sui-loader'
import { ShadowContainer } from '../plugins/ShadowContainer'
import type { SuiPlugin } from './sui-types'
import type { SuiAccountInfo } from './sui-types'

// --- Shared DAppKit instance ---
const GRPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
}

const NETWORKS = ['mainnet', 'testnet', 'devnet'] as const

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

// --- Plugin registry ---
const pluginPath = (name: string) =>
  import.meta.env.DEV
    ? `${import.meta.env.BASE_URL}plugins/${name}/plugin.tsx`
    : `${import.meta.env.BASE_URL}assets/plugins/${name}.js`

const SUI_PLUGINS = [
  {
    id: 'hello-world-sui',
    name: 'HelloWorldSui',
    label: 'Faucet',
    desc: 'Request SUI from faucet',
    src: pluginPath('hello-world-sui'),
    icon: '🚰',
  },
  {
    id: 'sui-wallet',
    name: 'SuiWallet',
    label: 'Wallet',
    desc: 'Balances & transactions',
    src: pluginPath('sui-wallet'),
    icon: '💼',
  },
  {
    id: 'sui-link',
    name: 'SuiLink',
    label: 'SuiLink',
    desc: 'Cross-chain wallet links',
    src: pluginPath('sui-link'),
    icon: '🔗',
  },
  {
    id: 'sui-dual-wallet',
    name: 'DualWallet',
    label: 'Dual Wallet',
    desc: 'Connect 2 wallets side by side',
    src: pluginPath('sui-dual-wallet'),
    icon: '⚡',
  },
  {
    id: 'sui-lending',
    name: 'SuiLending',
    label: 'Lending Pools',
    desc: 'Scallop lending markets',
    src: pluginPath('sui-lending'),
    icon: '🏦',
  },
  {
    id: 'sui-create-wallet',
    name: 'SuiCreateWallet',
    label: 'Create Wallet',
    desc: 'Generate Secp256k1 keypairs',
    src: pluginPath('sui-create-wallet'),
    icon: '🔐',
  },
]

interface LoadedPlugin {
  plugin: SuiPlugin
  componentNames: string[]
  meta: (typeof SUI_PLUGINS)[number]
}

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

// --- Inner dashboard ---
function DashboardInner() {
  const wallets = useWallets()
  const connection = useWalletConnection()
  const account = useCurrentAccount()
  const network = useCurrentNetwork()
  const dAppKitInstance = useDAppKit()

  const [loaded, setLoaded] = useState<LoadedPlugin[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [showWallets, setShowWallets] = useState(false)
  const [showAccountPicker, setShowAccountPicker] = useState(false)

  // All authorized accounts across all wallet connections
  const [allAccounts, setAllAccounts] = useState<
    { account: UiWalletAccount; walletName: string; walletIcon?: string }[]
  >([])

  // Sync DAppKit state → SuiHostAPI context
  useEffect(() => {
    const accountInfos: SuiAccountInfo[] = allAccounts.map((a) => ({
      address: a.account.address,
      walletName: a.walletName,
      walletIcon: a.walletIcon,
    }))
    updateSuiContext({
      address: account?.address ?? null,
      network,
      isConnected: connection.isConnected,
      accounts: accountInfos,
    })
  }, [account?.address, network, connection.isConnected, allAccounts])

  // Register dashboard actions
  useEffect(() => {
    registerActions({
      onConnect: () => setShowWallets(true),
      onDisconnect: () => {
        dAppKitInstance.disconnectWallet()
      },
      onNetworkSwitch: (net) => {
        dAppKitInstance.switchNetwork(net as (typeof NETWORKS)[number])
      },
      onSignAndExecuteTransaction: async (transaction) => {
        const result = await dAppKitInstance.signAndExecuteTransaction({ transaction })
        const tx = result.Transaction ?? result.FailedTransaction
        if (result.$kind === 'FailedTransaction') {
          throw new Error(`Transaction failed: ${tx?.digest}`)
        }
        return { digest: tx!.digest, effects: tx }
      },
    })
  }, [dAppKitInstance])

  // Connect a wallet and collect all its accounts
  const handleConnect = async (wallet: (typeof wallets)[0]) => {
    try {
      const result = await dAppKitInstance.connectWallet({ wallet })
      const newAccounts = (result.accounts || []).map((acc) => ({
        account: acc,
        walletName: wallet.name,
        walletIcon: wallet.icon,
      }))
      // Merge: add new accounts, avoid duplicates by address
      setAllAccounts((prev) => {
        const existing = new Set(prev.map((a) => a.account.address))
        const merged = [...prev]
        for (const a of newAccounts) {
          if (!existing.has(a.account.address)) {
            merged.push(a)
            existing.add(a.account.address)
          }
        }
        return merged
      })
      setShowWallets(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    }
  }

  const handleDisconnect = async () => {
    try {
      await dAppKitInstance.disconnectWallet()
      setAllAccounts([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    }
  }

  const handleSwitchAccount = (acc: UiWalletAccount) => {
    dAppKitInstance.switchAccount({ account: acc })
    setShowAccountPicker(false)
  }

  // Plugin loading
  const handleLoad = useCallback(async (meta: (typeof SUI_PLUGINS)[number]) => {
    let alreadyLoaded = false
    setLoaded((prev) => {
      if (prev.some((l) => l.meta.id === meta.id)) alreadyLoaded = true
      return prev
    })
    if (alreadyLoaded) {
      setActiveTab(meta.id)
      return
    }

    setLoadingId(meta.id)
    setError(null)
    const beforeComponents = new Set(getRegisteredSuiComponents())

    try {
      const plugin = await loadSuiPlugin(meta.src)
      plugin.mount?.()
      const afterComponents = getRegisteredSuiComponents()
      const newComponents = afterComponents.filter((c) => !beforeComponents.has(c))
      setLoaded((prev) => {
        if (prev.some((l) => l.meta.id === meta.id)) return prev
        return [...prev, { plugin, componentNames: newComponents, meta }]
      })
      setActiveTab(meta.id)
    } catch (err) {
      setError(`Failed to load ${meta.label}: ${err}`)
    } finally {
      setLoadingId(null)
    }
  }, [])

  const handleUnload = useCallback((id: string) => {
    setLoaded((prev) => {
      const target = prev.find((l) => l.meta.id === id)
      if (target) {
        target.plugin.unmount?.()
        target.componentNames.forEach(unregisterSuiComponent)
      }
      return prev.filter((l) => l.meta.id !== id)
    })
    setActiveTab((prev) => (prev === id ? null : prev))
  }, [])

  // Auto-load first plugin
  useEffect(() => {
    if (loaded.length === 0 && SUI_PLUGINS.length > 0) handleLoad(SUI_PLUGINS[0])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activePlugin = loaded.find((l) => l.meta.id === activeTab)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1e1e22] px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💧</span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">SUI Plugin Dashboard</h1>
              <p className="text-xs text-[#888]">Shared wallet context across all plugins</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Network selector */}
            <select
              className="rounded-md border border-[#333] bg-[#111] px-2.5 py-1.5 text-xs text-[#ccc] cursor-pointer"
              value={network}
              onChange={(e) =>
                dAppKitInstance.switchNetwork(e.target.value as (typeof NETWORKS)[number])
              }
            >
              {NETWORKS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            {/* Wallet / Account area */}
            {connection.isConnected && account ? (
              <div className="flex items-center gap-2 relative">
                {/* Active account button — click to open picker */}
                <button
                  onClick={() => setShowAccountPicker(!showAccountPicker)}
                  className="cursor-pointer flex items-center gap-1.5 rounded-md bg-[#4da2ff]/10 px-2.5 py-1.5 font-mono text-xs text-[#4da2ff] transition-colors hover:bg-[#4da2ff]/20"
                >
                  <span className="h-2 w-2 rounded-full bg-[#34d399]" />
                  {shortenAddr(account.address)}
                  {allAccounts.length > 1 && (
                    <span className="ml-1 rounded-full bg-[#4da2ff]/20 px-1.5 py-0 text-[10px]">
                      {allAccounts.length}
                    </span>
                  )}
                  <svg className="h-3 w-3 opacity-50" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M3 5l3 3 3-3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>

                {/* Account picker dropdown */}
                {showAccountPicker && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-[#1e1e22] bg-[#111113] p-3 shadow-xl">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#888]">
                        Accounts ({allAccounts.length})
                      </span>
                      <button
                        onClick={() => setShowWallets(true)}
                        className="cursor-pointer text-[10px] text-[#4da2ff] hover:underline"
                      >
                        + Connect another wallet
                      </button>
                    </div>
                    <div className="flex flex-col gap-1">
                      {allAccounts.map((a) => {
                        const isActive = a.account.address === account.address
                        return (
                          <button
                            key={a.account.address}
                            onClick={() => handleSwitchAccount(a.account)}
                            className={`cursor-pointer flex items-center gap-2.5 rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                              isActive
                                ? 'border-[#4da2ff]/50 bg-[#4da2ff]/10 text-[#4da2ff]'
                                : 'border-[#1e1e22] text-[#ccc] hover:border-[#333] hover:bg-[#18181c]'
                            }`}
                          >
                            {a.walletIcon && (
                              <img src={a.walletIcon} alt="" className="h-4 w-4 rounded" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-mono truncate">
                                {shortenAddr(a.account.address)}
                              </div>
                              <div className="text-[10px] text-[#666]">{a.walletName}</div>
                            </div>
                            {isActive && <span className="h-2 w-2 rounded-full bg-[#34d399]" />}
                          </button>
                        )
                      })}
                    </div>

                    {/* Wallet list for connecting more */}
                    {showWallets && (
                      <div className="mt-3 border-t border-[#1e1e22] pt-3">
                        <div className="mb-1.5 text-xs text-[#666]">Available wallets</div>
                        {wallets.map((w) => (
                          <button
                            key={w.name}
                            onClick={() => handleConnect(w)}
                            className="flex cursor-pointer items-center gap-2 rounded-md border border-[#1e1e22] px-3 py-2 text-left text-xs text-[#ccc] transition-colors hover:border-[#4da2ff]/50 hover:bg-[#18181c] w-full mb-1"
                          >
                            {w.icon && <img src={w.icon} alt="" className="h-4 w-4 rounded" />}
                            {w.name}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex justify-between border-t border-[#1e1e22] pt-2">
                      <button
                        onClick={() => setShowAccountPicker(false)}
                        className="cursor-pointer text-xs text-[#666] hover:text-[#aaa]"
                      >
                        Close
                      </button>
                      <button
                        onClick={handleDisconnect}
                        className="cursor-pointer text-xs text-[#f87171] hover:underline"
                      >
                        Disconnect all
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowWallets(!showWallets)}
                  disabled={connection.isConnecting}
                  className="cursor-pointer rounded-md bg-[#4da2ff] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#3d8ce6] disabled:opacity-50"
                >
                  {connection.isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
                {showWallets && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-[#1e1e22] bg-[#111113] p-3 shadow-xl">
                    {wallets.length === 0 ? (
                      <p className="text-xs text-[#666]">No wallets detected</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {wallets.map((wallet) => (
                          <button
                            key={wallet.name}
                            onClick={() => handleConnect(wallet)}
                            className="flex cursor-pointer items-center gap-2.5 rounded-md border border-[#1e1e22] px-3 py-2 text-left text-xs text-[#ccc] transition-colors hover:border-[#4da2ff]/50 hover:bg-[#18181c]"
                          >
                            {wallet.icon && (
                              <img src={wallet.icon} alt="" className="h-5 w-5 rounded" />
                            )}
                            {wallet.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setShowWallets(false)}
                      className="mt-2 w-full cursor-pointer rounded px-2 py-1 text-xs text-[#666] transition-colors hover:text-[#aaa]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            <a
              href="/"
              className="rounded-md border border-[#333] px-3 py-1.5 text-xs text-[#888] transition-colors hover:border-[#555] hover:text-[#ccc]"
            >
              ← Portfolio
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-0">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-[#1e1e22] p-4">
          <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#555]">
            Plugins
          </div>
          <nav className="flex flex-col gap-1">
            {SUI_PLUGINS.map((meta) => {
              const isLoaded = loaded.some((l) => l.meta.id === meta.id)
              const isActive = activeTab === meta.id
              const isLoading = loadingId === meta.id
              return (
                <button
                  key={meta.id}
                  onClick={() => handleLoad(meta)}
                  disabled={isLoading}
                  className={`group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-[#4da2ff]/10 text-[#4da2ff]'
                      : 'text-[#aaa] hover:bg-[#18181c] hover:text-[#ededed]'
                  }`}
                >
                  <span className="text-lg">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{meta.label}</span>
                      {isLoaded && <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />}
                    </div>
                    <div className="truncate text-xs text-[#666]">{meta.desc}</div>
                  </div>
                  {isLoading && (
                    <svg
                      className="h-4 w-4 animate-spin text-[#4da2ff]"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Active plugins */}
          {loaded.length > 0 && (
            <div className="mt-6 border-t border-[#1e1e22] pt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">
                Active ({loaded.length})
              </div>
              {loaded.map(({ meta, plugin }) => (
                <div
                  key={meta.id}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-xs"
                >
                  <span className="text-[#aaa]">
                    {meta.label} <span className="text-[#555]">v{plugin.version}</span>
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleUnload(meta.id)
                    }}
                    className="cursor-pointer rounded px-1.5 py-0.5 text-[#666] transition-colors hover:bg-[#2a0a0a] hover:text-[#f87171]"
                    title="Unload plugin"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Shared context */}
          <div className="mt-6 border-t border-[#1e1e22] pt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">
              Shared Context
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#666]">Network</span>
                <span className="rounded bg-[#1a1a1a] px-2 py-0.5 text-[#aaa]">{network}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#666]">Wallet</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${connection.isConnected ? 'bg-[#34d399]/10 text-[#34d399]' : 'bg-[#1a1a1a] text-[#666]'}`}
                >
                  {connection.isConnected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              {allAccounts.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[#666]">Accounts</span>
                  <span className="rounded bg-[#4da2ff]/10 px-2 py-0.5 text-[#4da2ff]">
                    {allAccounts.length}
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-800/50 bg-red-950/50 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          {activePlugin ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{activePlugin.meta.icon}</span>
                  <div>
                    <h2 className="text-base font-semibold">{activePlugin.meta.label}</h2>
                    <p className="text-xs text-[#888]">{activePlugin.meta.desc}</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#34d399]/10 px-2.5 py-0.5 text-xs text-[#34d399]">
                  v{activePlugin.plugin.version}
                </span>
              </div>
              <div className="rounded-xl border border-[#1e1e22] bg-[#111113] p-5">
                {activePlugin.componentNames.map((compName) => {
                  const Comp = suiHostAPI.getComponent(compName)
                  return Comp ? (
                    <ShadowContainer
                      key={`${activePlugin.meta.id}-${compName}`}
                      styleUrls={activePlugin.plugin.styleUrls}
                    >
                      <Comp />
                    </ShadowContainer>
                  ) : (
                    <div key={compName} className="text-sm text-[#666]">
                      Component "{compName}" not found
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mb-3 text-4xl">💧</div>
                <p className="text-sm text-[#888]">
                  Select a plugin from the sidebar to get started
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// --- Root ---
export function SuiDashboard() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <DashboardInner />
    </DAppKitProvider>
  )
}
