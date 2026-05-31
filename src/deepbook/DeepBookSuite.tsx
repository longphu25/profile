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

import { MissionControl } from './MissionControl'

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

type NavGroup = 'home' | 'trade' | 'predict' | 'portfolio' | 'bots' | 'rewards' | 'advanced'

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

const NAV_GROUPS: { id: NavGroup; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'trade', label: 'Trade', icon: '⇄' },
  { id: 'predict', label: 'Predict', icon: '◇' },
  { id: 'portfolio', label: 'Portfolio', icon: '◫' },
  { id: 'bots', label: 'Bots', icon: '⚙' },
  { id: 'rewards', label: 'Rewards', icon: '★' },
  { id: 'advanced', label: 'Advanced', icon: '◊' },
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

  // Quest progress for right rail
  const QUEST_COUNT = 6
  const questsDone = Object.values(
    (() => {
      try {
        return JSON.parse(localStorage.getItem('deepbook-quests-v1') || '{}')
      } catch {
        return {}
      }
    })(),
  ).filter(Boolean).length

  const handleGroupClick = (g: NavGroup) => {
    setActiveGroup(g)
    if (g === 'home' || g === 'rewards') return
    const first = groupPlugins(g)[0]
    if (first) selectPlugin(first.id)
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col pb-16 md:pb-0"
      style={{ background: 'var(--color-ink)' }}
    >
      {/* Top bar */}
      <header className="sticky top-0 z-40 mx-3 mt-3">
        <div
          className="mx-auto max-w-[1400px] flex items-center justify-between px-4 py-2.5 rounded-2xl border"
          style={{
            background: 'var(--color-panel)',
            borderColor: 'var(--color-line)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex items-center gap-2.5">
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

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV_GROUPS.map((g) => (
              <button type="button"
                key={g.id}
                onClick={() => handleGroupClick(g.id)}
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
              <button type="button"
                onClick={() => dAppKitInstance.disconnectWallet()}
                className="rounded-full px-3 py-1.5 text-[11px] font-medium cursor-pointer"
                style={{
                  background: 'rgba(128,255,213,0.1)',
                  color: 'var(--color-mint)',
                  border: '1px solid rgba(128,255,213,0.2)',
                }}
              >
                {fmtAddr(account.address)}
              </button>
            ) : (
              <button type="button"
                onClick={() => setShowWallets(true)}
                className="rounded-full px-4 py-1.5 text-[11px] font-semibold cursor-pointer"
                style={{ background: 'var(--color-mint)', color: 'var(--color-ink)' }}
              >
                Connect
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
                  <button type="button"
                    key={w.name}
                    onClick={async () => {
                      await dAppKitInstance.connectWallet({ wallet: w })
                      setShowWallets(false)
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl text-sm cursor-pointer"
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
      <main className="flex-1 mx-3 mt-3 mb-4">
        <div className="mx-auto max-w-[1400px] flex gap-4">
          {/* Left sidebar — plugin list */}
          {activeGroup !== 'home' && activeGroup !== 'rewards' && (
            <aside className="hidden lg:flex flex-col gap-1 w-40 shrink-0 pt-1">
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-2 px-2"
                style={{ color: 'var(--color-muted)' }}
              >
                {NAV_GROUPS.find((g) => g.id === activeGroup)?.label}
              </p>
              {groupPlugins(activeGroup).map((p) => (
                <button type="button"
                  key={p.id}
                  onClick={() => selectPlugin(p.id)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer text-left"
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
              <MissionControl
                commander={{
                  isConnected: connection.isConnected,
                  address: account?.address ?? null,
                  claimableCount: 0,
                  oracleHealth: null,
                  hasOpenPositions: false,
                  btcSpot: null,
                }}
                onSelectPlugin={selectPlugin}
                onConnect={() => setShowWallets(true)}
              />
            ) : activeGroup === 'rewards' ? (
              <RewardsPanel
                questsDone={questsDone}
                questTotal={QUEST_COUNT}
                isConnected={connection.isConnected}
                address={account?.address ?? null}
              />
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

          {/* Right rail — desktop only */}
          <aside className="hidden xl:flex flex-col gap-3 w-52 shrink-0 pt-1">
            {/* Wallet summary */}
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(8,24,25,0.82)', border: '1px solid var(--color-line)' }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: 'var(--color-muted)' }}
              >
                Wallet
              </p>
              {connection.isConnected && account ? (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-mono" style={{ color: 'var(--color-mint)' }}>
                    {fmtAddr(account.address)}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                    {network} · Connected
                  </p>
                </div>
              ) : (
                <button type="button"
                  onClick={() => setShowWallets(true)}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  style={{ background: 'var(--color-mint)', color: 'var(--color-ink)' }}
                >
                  Connect Wallet
                </button>
              )}
            </div>

            {/* Quest progress */}
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(8,24,25,0.82)', border: '1px solid var(--color-line)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Daily Quests
                </p>
                <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                  {questsDone}/{QUEST_COUNT}
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden mb-2"
                style={{ background: 'rgba(190,255,234,0.1)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(questsDone / QUEST_COUNT) * 100}%`,
                    background: 'var(--color-mint)',
                  }}
                />
              </div>
              <button type="button"
                onClick={() => setActiveGroup('rewards')}
                className="text-[10px] cursor-pointer transition-all"
                style={{ color: 'var(--color-teal)' }}
              >
                View quests →
              </button>
            </div>

            {/* Quick links */}
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(8,24,25,0.82)', border: '1px solid var(--color-line)' }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: 'var(--color-muted)' }}
              >
                Quick Links
              </p>
              <div className="flex flex-col gap-1">
                {[
                  { label: 'Predict', id: 'predict' },
                  { label: 'Portfolio', id: 'portfolio' },
                  { label: 'Swap', id: 'swap' },
                ].map((l) => (
                  <button type="button"
                    key={l.id}
                    onClick={() => selectPlugin(l.id)}
                    className="text-left text-xs py-1 cursor-pointer transition-all"
                    style={{
                      color: activePlugin === l.id ? 'var(--color-mint)' : 'var(--color-muted)',
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2"
        style={{
          background: 'var(--color-panel)',
          borderTop: '1px solid var(--color-line)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {NAV_GROUPS.slice(0, 6).map((g) => (
          <button type="button"
            key={g.id}
            onClick={() => handleGroupClick(g.id)}
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg cursor-pointer transition-all"
            style={{ color: activeGroup === g.id ? 'var(--color-mint)' : 'var(--color-muted)' }}
          >
            <span className="text-base leading-none">{g.icon}</span>
            <span className="text-[9px] font-medium">{g.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

// ── Rewards Panel ──────────────────────────────────────────────────────────────

const ACHIEVEMENTS = [
  { id: 'first-swap', label: 'First Swap', desc: 'Execute your first DeepBook swap' },
  { id: 'first-predict', label: 'First Predict Trade', desc: 'Mint a binary or range position' },
  { id: 'first-bot', label: 'Bot Operator', desc: 'Run or inspect a hedging cycle' },
  { id: 'first-risk', label: 'Risk Reviewer', desc: 'Complete a portfolio risk review' },
  { id: 'streak-3', label: '3-Day Streak', desc: 'Complete quests 3 days in a row' },
  { id: 'streak-7', label: '7-Day Streak', desc: 'Complete quests 7 days in a row' },
]

function RewardsPanel({
  questsDone,
  questTotal,
  isConnected,
}: {
  questsDone: number
  questTotal: number
  isConnected: boolean
  address: string | null
}) {
  const achievements: Record<string, boolean> = (() => {
    try {
      return JSON.parse(localStorage.getItem('deepbook-achievements-v1') || '{}')
    } catch {
      return {}
    }
  })()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-lg font-bold mb-1"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-satoshi)' }}
        >
          Rewards
        </h2>
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          Complete quests and earn achievements
        </p>
      </div>

      {/* Quest progress */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-muted)' }}
          >
            Daily Quests
          </p>
          <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
            {questsDone}/{questTotal}
          </span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden mb-1"
          style={{ background: 'rgba(190,255,234,0.1)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(questsDone / questTotal) * 100}%`,
              background: 'var(--color-mint)',
            }}
          />
        </div>
        <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
          {questsDone === questTotal
            ? '🎯 All quests completed today!'
            : `${questTotal - questsDone} quests remaining`}
        </p>
      </section>

      {/* Achievements */}
      <section>
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--color-muted)' }}
        >
          Achievements
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const done = !!achievements[a.id]
            return (
              <div
                key={a.id}
                className="flex items-start gap-3 p-3 rounded-xl"
                style={{
                  background: done ? 'rgba(128,255,213,0.06)' : 'rgba(8,24,25,0.82)',
                  border: `1px solid ${done ? 'rgba(128,255,213,0.2)' : 'var(--color-line)'}`,
                  opacity: done ? 1 : 0.6,
                }}
              >
                <div
                  className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
                  style={{
                    background: done ? 'rgba(128,255,213,0.15)' : 'rgba(190,255,234,0.06)',
                    color: done ? 'var(--color-mint)' : 'var(--color-muted)',
                  }}
                >
                  {done ? '✓' : '○'}
                </div>
                <div>
                  <p
                    className="text-xs font-semibold"
                    style={{ color: done ? 'var(--color-text)' : 'var(--color-muted)' }}
                  >
                    {a.label}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                    {a.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {!isConnected && (
        <p className="text-xs text-center" style={{ color: 'var(--color-muted)' }}>
          Connect wallet to track achievements on-chain in a future update
        </p>
      )}
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
