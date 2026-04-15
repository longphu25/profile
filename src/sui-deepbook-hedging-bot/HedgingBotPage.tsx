import { useState, useEffect, useRef, useCallback } from 'react'
import { suiHostAPI } from '../sui-dashboard/sui-host'
import { ShadowContainer } from '../plugins/ShadowContainer'

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
    id: 'hedging-bot',
    name: 'SuiDeepBookHedgingBot',
    label: 'Hedging Bot',
    src: pluginPath('sui-deepbook-hedging-bot'),
    styleUrl: '/plugins/sui-deepbook-hedging-bot/style.css',
  },
  {
    id: 'analysis',
    name: 'SuiDeepBookAnalysis',
    label: 'Analysis',
    src: pluginPath('sui-deepbook-analysis'),
    styleUrl: '/plugins/sui-deepbook-analysis/style.css',
  },
]

export function HedgingBotPage() {
  const [loaded, setLoaded] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState('both')
  const initRef = useRef(false)

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
    // Set default pool before plugins load
    suiHostAPI.setSharedData('deepbook:selectedPool', 'SUI_USDC')
    PLUGINS.forEach(loadPlugin)
  }, [loadPlugin])

  return (
    <div className="min-h-screen flex flex-col bg-[#020617]">
      {/* Header */}
      <header className="border-b border-[#1e293b] px-4 py-2.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-[#22c55e]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-[#f8fafc]">
                DeepBook Trading Dashboard
              </h1>
              <p className="text-[10px] text-[#64748b]">Hedging Bot + Analysis Engine</p>
            </div>
          </div>

          {/* Plugin tabs */}
          <div className="flex gap-1">
            {PLUGINS.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveTab(p.id)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
                  activeTab === p.id
                    ? 'bg-[#1e293b] text-[#22c55e] font-medium'
                    : 'text-[#64748b] hover:text-[#f8fafc] hover:bg-[#0f172a]'
                }`}
              >
                {loaded.has(p.id) ? '' : '○ '}{p.label}
              </button>
            ))}
            {/* Both view */}
            <button
              onClick={() => setActiveTab('both')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
                activeTab === 'both'
                  ? 'bg-[#1e293b] text-[#22c55e] font-medium'
                  : 'text-[#64748b] hover:text-[#f8fafc] hover:bg-[#0f172a]'
              }`}
            >
              Split View
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'both' ? (
          /* Split view: side by side */
          <div className="h-full grid grid-cols-2 divide-x divide-[#1e293b]">
            {PLUGINS.map((p) => (
              <div key={p.id} className="overflow-y-auto p-4">
                {errors[p.id] && (
                  <div className="mb-3 rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-400">
                    {p.label}: {errors[p.id]}
                  </div>
                )}
                {loaded.has(p.id) ? (
                  <ShadowContainer styleUrls={[p.styleUrl]}>
                    {(() => { const C = suiHostAPI.getComponent(p.name); return C ? <C /> : null })()}
                  </ShadowContainer>
                ) : !errors[p.id] ? (
                  <div className="text-center text-[#64748b] py-8 text-xs">Loading {p.label}…</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          /* Single plugin view */
          <div className="h-full overflow-y-auto p-4">
            <div className="mx-auto max-w-5xl">
              {PLUGINS.filter((p) => p.id === activeTab).map((p) => (
                <div key={p.id}>
                  {errors[p.id] && (
                    <div className="mb-3 rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-400">
                      {errors[p.id]}
                    </div>
                  )}
                  {loaded.has(p.id) ? (
                    <ShadowContainer styleUrls={[p.styleUrl]}>
                      {(() => { const C = suiHostAPI.getComponent(p.name); return C ? <C /> : null })()}
                    </ShadowContainer>
                  ) : !errors[p.id] ? (
                    <div className="text-center text-[#64748b] py-12 text-xs">Loading {p.label}…</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e293b] px-4 py-2 text-center text-[10px] text-[#475569]">
        Keys in memory only · Never sent to server · Cleared on tab close
      </footer>
    </div>
  )
}
