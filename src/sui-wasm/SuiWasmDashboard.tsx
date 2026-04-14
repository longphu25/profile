// SUI WASM Plugin Dashboard
// Loads plugins that use WASM-grade crypto (@noble/curves, @noble/hashes)
// or actual WebAssembly modules for heavy computation
//
// Architecture (from docs/plugin-wasm.md):
// - Plugin entry is always TS/ESM (compatible with existing loader)
// - Heavy logic (crypto, encoding, hashing) runs in WASM or WASM-grade JS
// - WASM cannot access DOM/wallet directly — JS wrapper handles that
// - This page shows WASM status and performance metrics for each plugin

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  getRegisteredSuiComponents,
  unregisterSuiComponent,
  suiHostAPI,
} from '../sui-dashboard/sui-host'
import { ShadowContainer } from '../plugins/ShadowContainer'
import { loadWasmPlugin, type WasmPlugin } from './wasm-loader'

// --- Plugin registry ---
const pluginPath = (name: string) =>
  import.meta.env.DEV
    ? `${import.meta.env.BASE_URL}plugins/${name}/plugin.tsx`
    : `${import.meta.env.BASE_URL}assets/plugins/${name}.js`

interface PluginEntry {
  id: string
  name: string
  label: string
  desc: string
  src: string
  wasmDesc: string
  noShadow?: boolean
}

interface PluginGroup {
  id: string
  label: string
  icon: string
  plugins: PluginEntry[]
}

const PLUGIN_GROUPS: PluginGroup[] = [
  {
    id: 'core',
    label: 'Core',
    icon: '🔑',
    plugins: [
      {
        id: 'sui-wallet-profile',
        name: 'SuiWalletProfile',
        label: 'Wallet Profile',
        desc: 'Connect wallet, SuiNS, tokens (required)',
        src: pluginPath('sui-wallet-profile'),
        wasmDesc: 'ESM + @mysten/dapp-kit + SuiNS',
        noShadow: true,
      },
      {
        id: 'sui-create-wallet',
        name: 'SuiCreateWallet',
        label: 'Create Wallet',
        desc: 'Generate Secp256k1 keypairs',
        src: pluginPath('sui-create-wallet'),
        wasmDesc: '@noble/curves + @noble/hashes + @scure/bip39',
      },
      {
        id: 'hello-world-sui',
        name: 'HelloWorldSui',
        label: 'Faucet',
        desc: 'Request SUI from faucet',
        src: pluginPath('hello-world-sui'),
        wasmDesc: 'Standard ESM',
      },
    ],
  },
  {
    id: 'deepbook',
    label: 'DeepBook Trading',
    icon: '📊',
    plugins: [
      {
        id: 'sui-pool-explorer',
        name: 'SuiPoolExplorer',
        label: 'Pool Explorer',
        desc: 'Browse all DeepBook v3 pools',
        src: pluginPath('sui-pool-explorer'),
        wasmDesc: 'DeepBook Indexer REST API',
      },
      {
        id: 'sui-deepbook-orderbook',
        name: 'SuiDeepBookOrderbook',
        label: 'Orderbook',
        desc: 'Live Level 2 orderbook + depth chart',
        src: pluginPath('sui-deepbook-orderbook'),
        wasmDesc: 'DeepBook Indexer REST API',
      },
      {
        id: 'sui-price-feed',
        name: 'SuiPriceFeed',
        label: 'Price Feed',
        desc: 'Live prices + OHLCV sparkline',
        src: pluginPath('sui-price-feed'),
        wasmDesc: 'DeepBook Indexer REST API',
      },
      {
        id: 'sui-swap',
        name: 'SuiSwap',
        label: 'Swap',
        desc: 'Trade via DeepBook v3 orderbook',
        src: pluginPath('sui-swap'),
        wasmDesc: '@mysten/deepbook-v3 SDK',
      },
      {
        id: 'sui-deepbook-portfolio',
        name: 'SuiDeepBookPortfolio',
        label: 'Portfolio',
        desc: 'Margin positions, collateral & points',
        src: pluginPath('sui-deepbook-portfolio'),
        wasmDesc: 'DeepBook Indexer REST API',
      },
      {
        id: 'sui-deepbook-history',
        name: 'SuiDeepBookHistory',
        label: 'Trade History',
        desc: 'Recent trades per pool',
        src: pluginPath('sui-deepbook-history'),
        wasmDesc: 'DeepBook Indexer REST API',
      },
      {
        id: 'sui-margin-manager',
        name: 'SuiMarginManager',
        label: 'Margin Manager',
        desc: 'Inspect margin positions & orders',
        src: pluginPath('sui-margin-manager'),
        wasmDesc: 'DeepBook Indexer REST API',
      },
      {
        id: 'sui-hedging-monitor',
        name: 'SuiHedgingMonitor',
        label: 'Hedging Monitor',
        desc: 'Monitor hedging bot instance',
        src: pluginPath('sui-hedging-monitor'),
        wasmDesc: 'Bot REST/SSE API',
      },
    ],
  },
  {
    id: 'walrus',
    label: 'Walrus Storage',
    icon: '🦭',
    plugins: [
      {
        id: 'sui-walrus-upload',
        name: 'SuiWalrusUpload',
        label: 'Upload',
        desc: 'Upload files to Walrus storage',
        src: pluginPath('sui-walrus-upload'),
        wasmDesc: 'Walrus Publisher HTTP API',
      },
      {
        id: 'sui-walrus-viewer',
        name: 'SuiWalrusViewer',
        label: 'Viewer',
        desc: 'View & download blobs by ID',
        src: pluginPath('sui-walrus-viewer'),
        wasmDesc: 'Walrus Aggregator HTTP API',
      },
      {
        id: 'sui-walrus-earn',
        name: 'SuiWalrusEarn',
        label: 'Earn WAL',
        desc: 'Stake WAL with storage nodes',
        src: pluginPath('sui-walrus-earn'),
        wasmDesc: '@mysten/sui on-chain + tx signing',
      },
      {
        id: 'sui-wal-swap',
        name: 'SuiWalSwap',
        label: 'WAL Swap',
        desc: 'Swap WAL ↔ SUI / USDC',
        src: pluginPath('sui-wal-swap'),
        wasmDesc: '@mysten/deepbook-v3 SDK',
      },
    ],
  },
  {
    id: 'payment',
    label: 'Payment Kit',
    icon: '💳',
    plugins: [
      {
        id: 'sui-payment',
        name: 'SuiPayment',
        label: 'Payment',
        desc: 'Create & pay payment requests',
        src: pluginPath('sui-payment'),
        wasmDesc: '@mysten/payment-kit',
      },
    ],
  },
  {
    id: 'defi',
    label: 'DeFi',
    icon: '🏦',
    plugins: [
      {
        id: 'sui-lending',
        name: 'SuiLending',
        label: 'Lending Pools',
        desc: 'Scallop lending markets',
        src: pluginPath('sui-lending'),
        wasmDesc: 'Scallop Indexer API',
      },
    ],
  },
]

// Flat list for lookup
const ALL_PLUGINS = PLUGIN_GROUPS.flatMap((g) => g.plugins)

interface LoadedPlugin {
  plugin: WasmPlugin
  componentNames: string[]
  meta: PluginEntry
  loadTimeMs: number
}

function WasmBadge({ usesWasm }: { usesWasm: boolean }) {
  return usesWasm ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
        <path d="M6.5 1A5.5 5.5 0 001 6.5 5.5 5.5 0 006.5 12H8v2.5a.5.5 0 001 0V12h1.5A5.5 5.5 0 0016 6.5 5.5 5.5 0 0010.5 1h-4zM5 6a1 1 0 112 0 1 1 0 01-2 0zm4 0a1 1 0 112 0 1 1 0 01-2 0z" />
      </svg>
      WASM
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-700/30 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
      ESM
    </span>
  )
}

export function SuiWasmDashboard() {
  const [loaded, setLoaded] = useState<LoadedPlugin[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [wasmSupported, setWasmSupported] = useState<boolean | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [walletInfo, setWalletInfo] = useState<{ address: string; network: string } | null>(null)
  const initRef = useRef(false)

  // Check WebAssembly support
  useEffect(() => {
    setWasmSupported(typeof WebAssembly !== 'undefined')
  }, [])

  // Track wallet from shared data
  useEffect(() => {
    return suiHostAPI.onSharedDataChange('walletProfile', (v) => {
      const p = v as { address: string; network: string } | null
      setWalletInfo(p ? { address: p.address, network: p.network } : null)
    })
  }, [])

  // Plugin loading
  const handleLoad = useCallback(async (meta: PluginEntry) => {
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
    const startTime = performance.now()

    try {
      const plugin = await loadWasmPlugin(meta.src, suiHostAPI)
      plugin.mount?.()
      const loadTimeMs = Math.round(performance.now() - startTime)

      const afterComponents = getRegisteredSuiComponents()
      const newComponents = afterComponents.filter((c) => !beforeComponents.has(c))

      setLoaded((prev) => {
        if (prev.some((l) => l.meta.id === meta.id)) return prev
        return [...prev, { plugin, componentNames: newComponents, meta, loadTimeMs }]
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
    if (!initRef.current && ALL_PLUGINS.length > 0) {
      initRef.current = true
      handleLoad(ALL_PLUGINS[0])
    }
  }, [handleLoad])

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const activePlugin = loaded.find((l) => l.meta.id === activeTab)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1e1e22] px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">SUI WASM Plugin Dashboard</h1>
              <p className="text-xs text-[#888]">
                Plugins with WASM-grade crypto and WebAssembly modules
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* WASM support indicator */}
            <div
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${
                wasmSupported ? 'bg-[#34d399]/10 text-[#34d399]' : 'bg-[#f87171]/10 text-[#f87171]'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${wasmSupported ? 'bg-[#34d399]' : 'bg-[#f87171]'}`}
              />
              {wasmSupported === null
                ? 'Checking...'
                : wasmSupported
                  ? 'WebAssembly OK'
                  : 'No WebAssembly'}
            </div>

            {/* Wallet + Network */}
            {walletInfo ? (
              <div className="flex items-center gap-1.5 rounded-md bg-[#34d399]/10 px-2.5 py-1.5 text-xs text-[#34d399]">
                <span className="h-2 w-2 rounded-full bg-[#34d399]" />
                {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-4)}
                <select
                  className="ml-1 rounded bg-[#18181c] px-1.5 py-0.5 text-[10px] text-[#888] border-none outline-none cursor-pointer"
                  value={walletInfo.network}
                  onChange={(e) => {
                    const net = e.target.value
                    // Update shared data so all plugins pick up the change
                    suiHostAPI.setSharedData('networkSwitch', net)
                    // Also update walletProfile network
                    const current = suiHostAPI.getSharedData('walletProfile') as Record<
                      string,
                      unknown
                    > | null
                    if (current) {
                      suiHostAPI.setSharedData('walletProfile', { ...current, network: net })
                    }
                  }}
                >
                  <option value="mainnet">mainnet</option>
                  <option value="testnet">testnet</option>
                  <option value="devnet">devnet</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-md bg-[#fbbf24]/10 px-2.5 py-1.5 text-xs text-[#fbbf24]">
                <span className="h-2 w-2 rounded-full bg-[#fbbf24]" />
                No wallet
              </div>
            )}

            <a
              href="/sui-plugin.html"
              className="rounded-md border border-[#333] px-3 py-1.5 text-xs text-[#888] transition-colors hover:border-[#555] hover:text-[#ccc]"
            >
              ← Dashboard
            </a>
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
        <aside className="w-72 shrink-0 border-r border-[#1e1e22] p-4">
          <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#555]">
            Plugins ({ALL_PLUGINS.length})
          </div>
          <nav className="flex flex-col gap-0.5">
            {PLUGIN_GROUPS.map((group) => {
              const isCollapsed = collapsedGroups.has(group.id)
              const groupLoadedCount = group.plugins.filter((p) =>
                loaded.some((l) => l.meta.id === p.id),
              ).length

              return (
                <div key={group.id}>
                  {/* Group header — collapsible */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-[#666] transition-colors hover:bg-[#18181c] hover:text-[#aaa]"
                  >
                    <span>{group.icon}</span>
                    <span className="flex-1">{group.label}</span>
                    {groupLoadedCount > 0 && (
                      <span className="rounded-full bg-[#34d399]/10 px-1.5 py-0.5 text-[9px] text-[#34d399]">
                        {groupLoadedCount}
                      </span>
                    )}
                    <span
                      className="text-[10px] text-[#555] transition-transform"
                      style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                    >
                      ▼
                    </span>
                  </button>

                  {/* Group plugins */}
                  {!isCollapsed && (
                    <div className="ml-2 flex flex-col gap-0.5 border-l border-[#1e1e22] pl-2">
                      {group.plugins.map((meta) => {
                        const isLoaded = loaded.some((l) => l.meta.id === meta.id)
                        const isActive = activeTab === meta.id
                        const isLoading = loadingId === meta.id
                        const loadedPlugin = loaded.find((l) => l.meta.id === meta.id)
                        const usesWasm =
                          loadedPlugin?.plugin._wasmMeta?.usesWasm ??
                          meta.wasmDesc.includes('noble')

                        return (
                          <button
                            key={meta.id}
                            onClick={() => handleLoad(meta)}
                            disabled={isLoading}
                            className={`group flex w-full cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                              isActive
                                ? 'bg-[#4da2ff]/10 text-[#4da2ff]'
                                : 'text-[#aaa] hover:bg-[#18181c] hover:text-[#ededed]'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium">{meta.label}</span>
                                {isLoaded && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />
                                )}
                                <WasmBadge usesWasm={usesWasm} />
                              </div>
                              <div className="mt-0.5 truncate text-[10px] text-[#555]">
                                {meta.desc}
                              </div>
                            </div>
                            {isLoading && (
                              <svg
                                className="mt-0.5 h-3.5 w-3.5 animate-spin text-[#4da2ff]"
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
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Loaded plugins info */}
          {loaded.length > 0 && (
            <div className="mt-6 border-t border-[#1e1e22] pt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">
                Active ({loaded.length})
              </div>
              {loaded.map(({ meta, plugin, loadTimeMs }) => (
                <div
                  key={meta.id}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-xs"
                >
                  <div>
                    <span className="text-[#aaa]">{meta.label}</span>
                    <span className="ml-1.5 text-[#555]">v{plugin.version}</span>
                    <span className="ml-1.5 text-[#444]">{loadTimeMs}ms</span>
                  </div>
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

          {/* Architecture info */}
          <div className="mt-6 border-t border-[#1e1e22] pt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">
              Architecture
            </div>
            <div className="space-y-2 text-[11px] text-[#666] leading-relaxed">
              <p>
                Plugin entry is always <span className="text-[#4da2ff]">TS/ESM</span>. Heavy crypto
                runs in <span className="text-purple-400">WASM-grade</span> modules.
              </p>
              <p>
                WASM cannot access DOM or wallet APIs directly — the JS wrapper handles all browser
                interactions.
              </p>
              <div className="mt-2 rounded-md bg-[#18181c] p-2 font-mono text-[10px] text-[#555]">
                <div>Plugin.tsx (ESM wrapper)</div>
                <div className="pl-2 text-purple-400">└─ @noble/curves (WASM-grade)</div>
                <div className="pl-2 text-purple-400">└─ @noble/hashes (BLAKE2b)</div>
                <div className="pl-2 text-purple-400">└─ @scure/bip39 (mnemonic)</div>
                <div className="pl-2 text-[#4da2ff]">└─ DOM / Wallet (JS only)</div>
              </div>
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
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold">{activePlugin.meta.label}</h2>
                      <WasmBadge usesWasm={activePlugin.plugin._wasmMeta?.usesWasm ?? false} />
                    </div>
                    <p className="text-xs text-[#888]">{activePlugin.meta.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#18181c] px-2.5 py-0.5 text-[10px] text-[#666]">
                    loaded in {activePlugin.loadTimeMs}ms
                  </span>
                  <span className="rounded-full bg-[#34d399]/10 px-2.5 py-0.5 text-xs text-[#34d399]">
                    v{activePlugin.plugin.version}
                  </span>
                </div>
              </div>

              {/* WASM info card */}
              {activePlugin.plugin._wasmMeta?.usesWasm && (
                <div className="mb-4 rounded-lg border border-purple-500/20 bg-purple-500/5 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M6.5 1A5.5 5.5 0 001 6.5 5.5 5.5 0 006.5 12H8v2.5a.5.5 0 001 0V12h1.5A5.5 5.5 0 0016 6.5 5.5 5.5 0 0010.5 1h-4zM5 6a1 1 0 112 0 1 1 0 01-2 0zm4 0a1 1 0 112 0 1 1 0 01-2 0z" />
                    </svg>
                    WASM-Grade Crypto Active
                  </div>
                  <p className="mt-1 text-[11px] text-[#888]">
                    {activePlugin.plugin._wasmMeta.wasmInfo}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-[#1e1e22] bg-[#111113] p-5">
                {activePlugin.componentNames.map((compName) => {
                  const Comp = suiHostAPI.getComponent(compName)
                  if (!Comp) {
                    return (
                      <div key={compName} className="text-sm text-[#666]">
                        Component "{compName}" not found
                      </div>
                    )
                  }
                  // Skip Shadow DOM for plugins that need full DOM access (wallet popups)
                  if (activePlugin.meta.noShadow) {
                    return <Comp key={`${activePlugin.meta.id}-${compName}`} />
                  }
                  return (
                    <ShadowContainer
                      key={`${activePlugin.meta.id}-${compName}`}
                      styleUrls={activePlugin.plugin.styleUrls}
                    >
                      <Comp />
                    </ShadowContainer>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mb-3 text-4xl">⚙️</div>
                <p className="text-sm text-[#888]">
                  Select a WASM plugin from the sidebar to get started
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
