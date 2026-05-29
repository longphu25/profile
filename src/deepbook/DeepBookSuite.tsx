/**
 * DeepBookSuite — Phase 1 shell (plan 04 / plan 06)
 * Grouped navigation, lazy-loaded plugins, shared wallet context.
 * Reuses SuiHostAPI, ShadowContainer, DAppKit from PredictPage pattern.
 */

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

// ── DAppKit ────────────────────────────────────────────────────────────────────

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

// ── Plugin registry ────────────────────────────────────────────────────────────

const pluginPath = (name: string) =>
  import.meta.env.DEV
    ? `${import.meta.env.BASE_URL}plugins/${name}/plugin.tsx`
    : `${import.meta.env.BASE_URL}assets/plugins/${name}.js`

interface PluginDef {
  id: string
  name: string
  label: string
  src: string
  styleUrl: string
  group: NavGroup
  status: 'live' | 'simulated' | 'coming-soon'
}

type NavGroup = 'home' | 'trade' | 'predict' | 'portfolio' | 'bots' | 'advanced'

const PLUGINS: PluginDef[] = [
  {
    id: 'predict',
    name: 'SuiDeepBookPredict',
    label: 'Predict',
    src: pluginPath('sui-deepbook-predict'),
    styleUrl: '/plugins/sui-deepbook-predict/style.css',
    group: 'predict',
    status: 'live',
  },
  {
    id: 'swap',
    name: 'SuiSwap',
    label: 'Swap',
    src: pluginPath('sui-swap'),
    styleUrl: '/plugins/sui-swap/style.css',
    group: 'trade',
    status: 'live',
  },
  {
    id: 'orderbook',
    name: 'SuiDeepBookOrderbook',
    label: 'Orderbook',
    src: pluginPath('sui-deepbook-orderbook'),
    styleUrl: '/plugins/sui-deepbook-orderbook/style.css',
    group: 'trade',
    status: 'live',
  },
  {
    id: 'portfolio',
    name: 'SuiDeepBookPortfolio',
    label: 'Portfolio',
    src: pluginPath('sui-deepbook-portfolio'),
    styleUrl: '/plugins/sui-deepbook-portfolio/style.css',
    group: 'portfolio',
    status: 'live',
  },
  {
    id: 'margin',
    name: 'SuiMarginManager',
    label: 'Margin',
    src: pluginPath('sui-margin-manager'),
    styleUrl: '/plugins/sui-margin-manager/style.css',
    group: 'portfolio',
    status: 'live',
  },
  {
    id: 'hedging-bot',
    name: 'SuiDeepBookHedgingBot',
    label: 'Hedging Bot',
    src: pluginPath('sui-deepbook-hedging-bot'),
    styleUrl: '/plugins/sui-deepbook-hedging-bot/style.css',
    group: 'bots',
    status: 'live',
  },
  {
    id: 'hedging-monitor',
    name: 'SuiHedgingMonitor',
    label: 'Bot Monitor',
    src: pluginPath('sui-hedging-monitor'),
    styleUrl: '/plugins/sui-hedging-monitor/style.css',
    group: 'bots',
    status: 'live',
  },
  {
    id: 'analysis',
    name: 'SuiDeepBookAnalysis',
    label: 'Analysis',
    src: pluginPath('sui-deepbook-analysis'),
    styleUrl: '/plugins/sui-deepbook-analysis/style.css',
    group: 'advanced',
    status: 'live',
  },
  {
    id: 'pool-explorer',
    name: 'SuiPoolExplorer',
    label: 'Pool Explorer',
    src: pluginPath('sui-pool-explorer'),
    styleUrl: '/plugins/sui-pool-explorer/style.css',
    group: 'advanced',
    status: 'live',
  },
  {
    id: 'price-feed',
    name: 'SuiPriceFeed',
    label: 'Price Feed',
    src: pluginPath('sui-price-feed'),
    styleUrl: '/plugins/sui-price-feed/style.css',
    group: 'advanced',
    status: 'live',
  },
]

const NAV_GROUPS: { id: NavGroup; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'trade', label: 'Trade' },
  { id: 'predict', label: 'Predict' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'bots', label: 'Bots' },
  { id: 'advanced', label: 'Advanced' },
]

// ── Inner app ──────────────────────────────────────────────────────────────────

function DeepBookInner() {
  const [activeGroup, setActiveGroup] = useState<NavGroup>('predict')
  const [activePlugin, setActivePlugin] = useState<string>('predict')
  const [loaded, setLoaded] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showWallets, setShowWallets] = useState(false)
  const initRef = useRef<Set<string>>(new Set())

  const wallets = useWallets()
  const connection = useWalletConnection()
  const account = useCurrentAccount()
  const network = useCurrentNetwork()
  const dAppKitInstance = useDAppKit()

  // Sync wallet context
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

  // Register actions
  useEffect(() => {
    registerActions({
      onConnect: () => setShowWallets(true),
      onDisconnect: () => dAppKitInstance.disconnectWallet(),
      onNetworkSwitch: (net) =>
        dAppKitInstance.switchNetwork(net as 'mainnet' | 'testnet' | 'devnet'),
      onSignAndExecuteTransaction: async (transaction) => {
        const result = await dAppKitInstance.signAndExecuteTransaction({ transaction })
        const tx = result.Transaction ?? result.FailedTransaction
        if (result.$kind === 'FailedTransaction') throw new Error(`TX failed: ${tx?.digest}`)
        return { digest: tx!.digest, effects: tx }
      },
      onSignPersonalMessage: async (message) => {
        const result = await dAppKitInstance.signPersonalMessage({ message })
        return { signature: result.signature, bytes: result.bytes }
      },
    })
  }, [dAppKitInstance])

  // Lazy-load plugin on demand
  const loadPlugin = useCallback(async (p: PluginDef) => {
    if (initRef.current.has(p.id)) return
    initRef.current.add(p.id)
    try {
      const bustUrl = `${p.src}${p.src.includes('?') ? '&' : '?'}t=${Date.now()}`
      const module = await import(/* @vite-ignore */ bustUrl)
      const plugin = module.default
      if (!plugin?.name || !plugin?.init) throw new Error('Invalid plugin')
      plugin.init(suiHostAPI)
      plugin.mount?.()
      setLoaded((prev) => new Set(prev).add(p.id))
    } catch (err) {
      setErrors((prev) => ({ ...prev, [p.id]: err instanceof Error ? err.message : String(err) }))
    }
  }, [])

  // Load plugin when selected
  useEffect(() => {
    const p = PLUGINS.find((x) => x.id === activePlugin)
    if (p) loadPlugin(p)
  }, [activePlugin, loadPlugin])

  const groupPlugins = (group: NavGroup) => PLUGINS.filter((p) => p.group === group)

  const selectPlugin = (id: string) => {
    const p = PLUGINS.find((x) => x.id === id)
    if (p) {
      setActiveGroup(p.group)
      setActivePlugin(id)
    }
  }

  const fmtAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

  const activePluginDef = PLUGINS.find((p) => p.id === activePlugin)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-ink)' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-40 mx-4 mt-4">
        <div
          className="mx-auto max-w-[1400px] flex items-center justify-between px-5 py-3 rounded-2xl border"
          style={{
            background: 'var(--color-panel)',
            borderColor: 'var(--color-line)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-bold"
              style={{ color: 'var(--color-mint)', fontFamily: 'var(--font-satoshi)' }}
            >
              DeepBook Suite
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: 'rgba(128,255,213,0.08)',
                color: 'var(--color-mint)',
                border: '1px solid rgba(128,255,213,0.2)',
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--color-mint)' }}
              />
              Testnet
            </span>
          </div>

          {/* Nav groups */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setActiveGroup(g.id)
                  if (g.id === 'home') return
                  const first = groupPlugins(g.id)[0]
                  if (first) selectPlugin(first.id)
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
                style={{
                  background: activeGroup === g.id ? 'rgba(128,255,213,0.12)' : 'transparent',
                  color: activeGroup === g.id ? 'var(--color-mint)' : 'var(--color-muted)',
                  border:
                    activeGroup === g.id
                      ? '1px solid rgba(128,255,213,0.2)'
                      : '1px solid transparent',
                }}
              >
                {g.label}
              </button>
            ))}
          </nav>

          {/* Wallet */}
          <div className="flex items-center gap-2">
            {connection.isConnected && account ? (
              <button
                onClick={() => dAppKitInstance.disconnectWallet()}
                className="rounded-full px-3 py-1.5 text-[11px] font-medium cursor-pointer transition-all"
                style={{
                  background: 'rgba(128,255,213,0.1)',
                  color: 'var(--color-mint)',
                  border: '1px solid rgba(128,255,213,0.2)',
                }}
              >
                {fmtAddr(account.address)}
              </button>
            ) : (
              <button
                onClick={() => setShowWallets(true)}
                className="rounded-full px-4 py-1.5 text-[11px] font-semibold cursor-pointer transition-all"
                style={{ background: 'var(--color-mint)', color: 'var(--color-ink)' }}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Wallet modal */}
      {showWallets && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(7,16,17,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowWallets(false)}
        >
          <div
            className="rounded-2xl p-6 w-80"
            style={{ background: 'var(--color-panel)', border: '1px solid var(--color-line)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
              Connect Wallet
            </h3>
            {wallets.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                No wallets detected. Install Sui Wallet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {wallets.map((w) => (
                  <button
                    key={w.name}
                    onClick={async () => {
                      await dAppKitInstance.connectWallet({ wallet: w })
                      setShowWallets(false)
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl text-sm cursor-pointer transition-all"
                    style={{
                      background: 'rgba(190,255,234,0.06)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-line)',
                    }}
                  >
                    {w.icon && <img src={w.icon} alt={w.name} className="h-5 w-5 rounded" />}
                    {w.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main layout */}
      <main className="flex-1 mx-4 mt-4 mb-8">
        <div className="mx-auto max-w-[1400px] flex gap-4">
          {/* Sidebar — plugin list for active group */}
          {activeGroup !== 'home' && (
            <aside className="hidden lg:flex flex-col gap-1 w-44 shrink-0 pt-1">
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-2 px-2"
                style={{ color: 'var(--color-muted)' }}
              >
                {NAV_GROUPS.find((g) => g.id === activeGroup)?.label}
              </p>
              {groupPlugins(activeGroup).map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPlugin(p.id)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all text-left"
                  style={{
                    background: activePlugin === p.id ? 'rgba(128,255,213,0.1)' : 'transparent',
                    color: activePlugin === p.id ? 'var(--color-mint)' : 'var(--color-muted)',
                    border:
                      activePlugin === p.id
                        ? '1px solid rgba(128,255,213,0.18)'
                        : '1px solid transparent',
                  }}
                >
                  <span>{p.label}</span>
                  {p.status === 'live' && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: 'var(--color-mint)' }}
                    />
                  )}
                </button>
              ))}
            </aside>
          )}

          {/* Plugin workspace */}
          <div className="flex-1 min-w-0">
            {activeGroup === 'home' ? (
              <MissionControl onSelectPlugin={selectPlugin} />
            ) : activePluginDef ? (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid var(--color-line)', background: 'var(--color-panel)' }}
              >
                {errors[activePlugin] ? (
                  <div className="p-6 text-xs" style={{ color: '#ff6b6b' }}>
                    Failed to load {activePluginDef.label}: {errors[activePlugin]}
                  </div>
                ) : !loaded.has(activePlugin) ? (
                  <div className="p-6 text-xs" style={{ color: 'var(--color-muted)' }}>
                    Loading {activePluginDef.label}…
                  </div>
                ) : (
                  <ShadowContainer styleUrls={[activePluginDef.styleUrl]}>
                    {(() => {
                      const Comp = suiHostAPI.getComponent(activePluginDef.name)
                      return Comp ? <Comp /> : null
                    })()}
                  </ShadowContainer>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}

// ── Mission Control (Home) ─────────────────────────────────────────────────────

function MissionControl({ onSelectPlugin }: { onSelectPlugin: (id: string) => void }) {
  const QUICK_ACTIONS = [
    {
      id: 'predict',
      label: 'Predict Market',
      desc: 'Trade BTC binary & range options',
      group: 'predict',
    },
    { id: 'swap', label: 'Swap Tokens', desc: 'DeepBook V3 spot swap', group: 'trade' },
    {
      id: 'portfolio',
      label: 'View Portfolio',
      desc: 'Positions, PnL, settlements',
      group: 'portfolio',
    },
    {
      id: 'hedging-bot',
      label: 'Run Hedging Bot',
      desc: 'Automated delta-neutral strategy',
      group: 'bots',
    },
    {
      id: 'analysis',
      label: 'Market Analysis',
      desc: 'Pool stats, price feeds, depth',
      group: 'advanced',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1
          className="text-2xl font-bold mb-1"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-satoshi)' }}
        >
          DeepBook Suite
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Trade, predict, analyze, and automate on DeepBook V3
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelectPlugin(a.id)}
            className="flex flex-col gap-1 p-4 rounded-xl text-left cursor-pointer transition-all"
            style={{
              background: 'rgba(8,24,25,0.82)',
              border: '1px solid var(--color-line)',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(128,255,213,0.3)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-line)'
            }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {a.label}
            </span>
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {a.desc}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Root export ────────────────────────────────────────────────────────────────

export function DeepBookSuite() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <DeepBookInner />
    </DAppKitProvider>
  )
}
