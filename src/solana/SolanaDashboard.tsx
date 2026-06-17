// Solana Dashboard — loads and renders Solana plugins

import { useState, useCallback, useEffect, useRef } from 'react'
import { solanaHostAPI, getRegisteredSolanaComponents } from './solana-host'
import { ShadowContainer } from '../plugins/ShadowContainer'
import { loadWasmPlugin, type WasmPlugin } from '../sui-wasm/wasm-loader'

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
  noShadow?: boolean
}

const SOLANA_PLUGINS: PluginEntry[] = [
  {
    id: 'solana-wallet-profile',
    name: 'SolanaWalletProfile',
    label: 'Wallet Profile',
    desc: 'Connect Solana wallet, view SOL balance (devnet)',
    src: pluginPath('solana-wallet-profile'),
    noShadow: true,
  },
  {
    id: 'solana-faucet',
    name: 'SolanaFaucet',
    label: 'Faucet',
    desc: 'Request SOL airdrop on devnet/testnet',
    src: pluginPath('solana-faucet'),
    noShadow: true,
  },
  {
    id: 'solana-create-wallet',
    name: 'SolanaCreateWallet',
    label: 'Create Wallet',
    desc: 'Generate Ed25519 keypairs, stored locally (devnet/testnet)',
    src: pluginPath('solana-create-wallet'),
    noShadow: true,
  },
]

interface LoadedPlugin {
  plugin: WasmPlugin
  componentNames: string[]
  meta: PluginEntry
}

export function SolanaDashboard() {
  const [loaded, setLoaded] = useState<LoadedPlugin[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const initRef = useRef(false)

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
    const beforeComponents = new Set(getRegisteredSolanaComponents())

    try {
      const plugin = await loadWasmPlugin(meta.src, solanaHostAPI)
      plugin.mount?.()
      const afterComponents = getRegisteredSolanaComponents()
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

  // Auto-load first plugin
  useEffect(() => {
    if (!initRef.current && SOLANA_PLUGINS.length > 0) {
      initRef.current = true
      handleLoad(SOLANA_PLUGINS[0])
    }
  }, [handleLoad])

  const activePlugin = loaded.find((l) => l.meta.id === activeTab)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1e1e22] px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <SolanaLogo />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Solana Plugin Dashboard</h1>
              <p className="text-xs text-[#888]">Devnet | Phantom wallet</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-4 p-4">
        {/* Sidebar */}
        <aside className="w-64 shrink-0">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#888]">
            Plugins
          </h2>
          <div className="flex flex-col gap-2">
            {SOLANA_PLUGINS.map((p) => {
              const isLoaded = loaded.some((l) => l.meta.id === p.id)
              const isActive = activeTab === p.id
              return (
                <button
                  key={p.id}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'border-[#9945ff] bg-[#9945ff]/10 text-white'
                      : isLoaded
                        ? 'border-[#2a2a2e] bg-[#111113] text-[#ccc] hover:border-[#9945ff]/50'
                        : 'border-[#2a2a2e] bg-transparent text-[#888] hover:bg-[#111113]'
                  }`}
                  onClick={() => handleLoad(p)}
                  disabled={loadingId === p.id}
                >
                  <div className="font-medium">{p.label}</div>
                  <div className="mt-0.5 text-xs opacity-70">{p.desc}</div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 rounded-xl border border-[#1e1e22] bg-[#111113] p-4">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {activePlugin ? (
            <PluginView plugin={activePlugin} />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-[#555]">
              {loadingId ? 'Loading plugin...' : 'Select a plugin from the sidebar'}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function PluginView({ plugin }: { plugin: LoadedPlugin }) {
  return (
    <>
      {plugin.componentNames.map((name) => {
        const Component = solanaHostAPI.getComponent(name)
        if (!Component) return null
        if (plugin.meta.noShadow) return <Component key={name} />
        return (
          <ShadowContainer key={name} styleUrls={plugin.plugin.styleUrls}>
            <Component />
          </ShadowContainer>
        )
      })}
    </>
  )
}

function SolanaLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 128 128" fill="none">
      <defs>
        <linearGradient id="sol-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9945FF" />
          <stop offset="100%" stopColor="#14F195" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="24" fill="#111" />
      <path
        d="M34 84.5h48.7c.8 0 1.6.3 2.2.9l8.8 8.8c1 1 .3 2.8-1.2 2.8H43.8c-.8 0-1.6-.3-2.2-.9l-8.8-8.8c-1-1-.3-2.8 1.2-2.8z"
        fill="url(#sol-grad)"
      />
      <path
        d="M34 56h48.7c.8 0 1.6.3 2.2.9l8.8 8.8c1 1 .3 2.8-1.2 2.8H43.8c-.8 0-1.6-.3-2.2-.9l-8.8-8.8c-1-1-.3-2.8 1.2-2.8z"
        fill="url(#sol-grad)"
        opacity="0.7"
      />
      <path
        d="M93.7 31H45c-.8 0-1.6.3-2.2.9l-8.8 8.8c-1 1-.3 2.8 1.2 2.8h48.7c.8 0 1.6-.3 2.2-.9l8.8-8.8c1-1 .3-2.8-1.2-2.8z"
        fill="url(#sol-grad)"
        opacity="0.5"
      />
    </svg>
  )
}
