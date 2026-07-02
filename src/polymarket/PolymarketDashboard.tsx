// Polymarket Weather Dashboard
// Plugin-based architecture — loads plugins from /plugins/ directory
// Same pattern as SuiWasmDashboard but without Shadow DOM (no wallet popups needed)

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  getRegisteredSuiComponents,
  unregisterSuiComponent,
  suiHostAPI,
} from '../sui-dashboard/sui-host'
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
  icon: string
}

const PLUGINS: PluginEntry[] = [
  {
    id: 'polymarket-wallet',
    name: 'PolymarketWallet',
    label: 'Wallet',
    desc: 'Create or import Polygon wallet for Polymarket',
    src: pluginPath('polymarket-wallet'),
    icon: '👛',
  },
  {
    id: 'polymarket',
    name: 'Polymarket',
    label: 'Polymarket',
    desc: 'Markets explorer + WASM offline signing',
    src: pluginPath('polymarket'),
    icon: '📈',
  },
  {
    id: 'polymarket-detail',
    name: 'PolymarketDetail',
    label: 'Event Detail',
    desc: 'Detailed view of a selected market',
    src: pluginPath('polymarket-detail'),
    icon: '📊',
  },
]

interface LoadedPlugin {
  plugin: WasmPlugin
  componentNames: string[]
  meta: PluginEntry
  loadTimeMs: number
}

export function PolymarketDashboard() {
  const [loaded, setLoaded] = useState<LoadedPlugin[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [walletAddr, setWalletAddr] = useState<string | null>(null)
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

  // Auto-load wallet plugin first, then main plugin
  useEffect(() => {
    if (initRef.current || PLUGINS.length === 0) {
      return
    }
    initRef.current = true
    const timer = window.setTimeout(() => {
      const walletPlugin = PLUGINS.find((p) => p.id === 'polymarket-wallet')
      const mainPlugin = PLUGINS.find((p) => p.id === 'polymarket')
      if (!walletPlugin) return

      handleLoad(walletPlugin).then(() => {
        if (mainPlugin) handleLoad(mainPlugin)
      })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [handleLoad])

  // Listen for card click → auto-load detail plugin
  useEffect(() => {
    const unsub1 = suiHostAPI.onSharedDataChange('polymarket:selectedEvent', (val) => {
      if (val) {
        const detailMeta = PLUGINS.find((p) => p.id === 'polymarket-detail')
        if (detailMeta) handleLoad(detailMeta)
      }
    })
    // Listen for back navigation → switch to weather
    const unsub2 = suiHostAPI.onSharedDataChange('polymarket:navigate', (val) => {
      if (val === 'weather') {
        setActiveTab('polymarket-weather')
        suiHostAPI.setSharedData('polymarket:navigate', null)
      }
    })
    return () => {
      unsub1()
      unsub2()
    }
  }, [handleLoad])

  // Track wallet connection
  useEffect(() => {
    return suiHostAPI.onSharedDataChange('polymarket:wallet', (val) => {
      const w = val as { address: string } | null
      setWalletAddr(w?.address ?? null)
    })
  }, [])

  const activePlugin = loaded.find((l) => l.meta.id === activeTab)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid #1e1e22',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#58a6ff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            <circle cx="12" cy="12" r="5" />
          </svg>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Polymarket Weather</div>
            <div style={{ fontSize: 11, color: '#888' }}>
              Prediction markets — plugin architecture
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {walletAddr && (
            <span
              style={{
                fontSize: 11,
                color: '#8247e5',
                background: 'rgba(130,71,229,0.1)',
                padding: '3px 10px',
                borderRadius: 12,
                fontFamily: 'monospace',
              }}
            >
              {walletAddr.slice(0, 6)}...{walletAddr.slice(-4)}
            </span>
          )}
          {loaded.length > 0 && (
            <span
              style={{
                fontSize: 11,
                color: '#34d399',
                background: 'rgba(52,211,153,0.1)',
                padding: '3px 10px',
                borderRadius: 12,
              }}
            >
              {loaded.length} plugin loaded
            </span>
          )}
          <a
            href="/sui-plugin-wasm.html"
            style={{
              fontSize: 11,
              color: '#888',
              border: '1px solid #333',
              padding: '4px 12px',
              borderRadius: 6,
              textDecoration: 'none',
            }}
          >
            SUI Dashboard
          </a>
          <a
            href="/"
            style={{
              fontSize: 11,
              color: '#888',
              border: '1px solid #333',
              padding: '4px 12px',
              borderRadius: 6,
              textDecoration: 'none',
            }}
          >
            Home
          </a>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 240,
            flexShrink: 0,
            borderRight: '1px solid #1e1e22',
            padding: 16,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: '#555',
              marginBottom: 10,
            }}
          >
            Plugins ({PLUGINS.length})
          </div>
          <nav>
            {PLUGINS.map((meta) => {
              const isLoaded = loaded.some((l) => l.meta.id === meta.id)
              const isActive = activeTab === meta.id
              const isLoading = loadingId === meta.id

              return (
                <button
                  type="button"
                  key={meta.id}
                  onClick={() => handleLoad(meta)}
                  disabled={isLoading}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: isActive ? 'rgba(88,166,255,0.1)' : 'transparent',
                    color: isActive ? '#58a6ff' : '#aaa',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 12,
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 500 }}>{meta.label}</span>
                      {isLoaded && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#34d399',
                            display: 'inline-block',
                          }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: '#555',
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {meta.desc}
                    </div>
                  </div>
                  {isLoading && (
                    <svg
                      style={{
                        width: 14,
                        height: 14,
                        animation: 'spin 0.8s linear infinite',
                        color: '#58a6ff',
                      }}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        style={{ opacity: 0.25 }}
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        style={{ opacity: 0.75 }}
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  )}
                </button>
              )
            })}
          </nav>

          {loaded.length > 0 && (
            <div style={{ marginTop: 20, borderTop: '1px solid #1e1e22', paddingTop: 14 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: '#555',
                  marginBottom: 8,
                }}
              >
                Active
              </div>
              {loaded.map(({ meta, plugin, loadTimeMs }) => (
                <div
                  key={meta.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    fontSize: 11,
                  }}
                >
                  <div>
                    <span style={{ color: '#aaa' }}>{meta.label}</span>
                    <span style={{ color: '#555', marginLeft: 6 }}>v{plugin.version}</span>
                    <span style={{ color: '#444', marginLeft: 6 }}>{loadTimeMs}ms</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnload(meta.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#666',
                      cursor: 'pointer',
                      fontSize: 12,
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                    title="Unload"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Main content — NO Shadow DOM, render plugin directly */}
        <main style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: 16,
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid rgba(248,81,73,0.3)',
                background: 'rgba(248,81,73,0.08)',
                color: '#f87171',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {activePlugin ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{activePlugin.meta.label}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{activePlugin.meta.desc}</div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: '#34d399',
                    background: 'rgba(52,211,153,0.1)',
                    padding: '3px 10px',
                    borderRadius: 12,
                  }}
                >
                  v{activePlugin.plugin.version} — {activePlugin.loadTimeMs}ms
                </span>
              </div>

              {/* Render plugin components directly — no ShadowContainer */}
              {activePlugin.componentNames.map((compName) => {
                const Comp = suiHostAPI.getComponent(compName)
                if (!Comp) {
                  return (
                    <div key={compName} style={{ padding: 20, color: '#666', fontSize: 13 }}>
                      Component "{compName}" not found
                    </div>
                  )
                }
                return <Comp key={`${activePlugin.meta.id}-${compName}`} />
              })}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🌤</div>
                <p style={{ fontSize: 13, color: '#888' }}>Select a plugin from the sidebar</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
