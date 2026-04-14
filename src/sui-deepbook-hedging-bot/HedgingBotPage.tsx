import { useState, useEffect, useRef } from 'react'
import { suiHostAPI } from '../sui-dashboard/sui-host'
import { ShadowContainer } from '../plugins/ShadowContainer'

const COMPONENT_NAME = 'SuiDeepBookHedgingBot'

const pluginSrc = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}plugins/sui-deepbook-hedging-bot/plugin.tsx`
  : `${import.meta.env.BASE_URL}assets/plugins/sui-deepbook-hedging-bot.js`

export function HedgingBotPage() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    ;(async () => {
      try {
        console.log('[HedgingBotPage] Loading plugin from:', pluginSrc)
        const bustUrl = `${pluginSrc}${pluginSrc.includes('?') ? '&' : '?'}t=${Date.now()}`
        const module = await import(/* @vite-ignore */ bustUrl)
        console.log('[HedgingBotPage] Module loaded, keys:', Object.keys(module))
        const plugin = module.default
        if (!plugin?.name || !plugin?.init) {
          throw new Error(`Invalid plugin: name=${plugin?.name}, init=${typeof plugin?.init}`)
        }
        console.log('[HedgingBotPage] Calling init...')
        plugin.init(suiHostAPI)
        plugin.mount?.()
        const comp = suiHostAPI.getComponent(COMPONENT_NAME)
        console.log('[HedgingBotPage] Component registered:', !!comp)
        if (!comp) throw new Error(`Component "${COMPONENT_NAME}" not found after init`)
        setReady(true)
      } catch (err) {
        console.error('[HedgingBotPage] Error:', err)
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
  }, [])

  const Component = ready ? suiHostAPI.getComponent(COMPONENT_NAME) : null

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[#1e293b] px-6 py-3">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-6 w-6 text-[#22c55e]"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[#f8fafc]">
              DeepBook Hedging Bot
            </h1>
            <p className="text-xs text-[#64748b]">Client-side hedging — no server required</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-5xl">
          {error && (
            <div className="mb-4 rounded-lg border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          {Component ? (
            <ShadowContainer styleUrls={['/plugins/sui-deepbook-hedging-bot/style.css']}>
              <Component />
            </ShadowContainer>
          ) : !error ? (
            <div className="text-center text-[#64748b] py-12">Loading plugin…</div>
          ) : null}
        </div>
      </main>

      <footer className="border-t border-[#1e293b] px-6 py-3 text-center text-xs text-[#475569]">
        Keys are kept in memory only · Never sent to any server · Cleared on tab close
      </footer>
    </div>
  )
}
