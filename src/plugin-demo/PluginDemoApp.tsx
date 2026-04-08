import { useState, useCallback } from 'react'
import { hostAPI, getRegisteredComponents, unregisterComponent } from '../plugins/host'
import { loadPlugin } from '../plugins/loader'
import { ShadowContainer } from '../plugins/ShadowContainer'
import type { Plugin } from '../plugins/types'

// Static plugin registry — add your plugins here
// In dev, Vite serves .tsx directly; in production, plugins are pre-built entry points
const pluginPath = (name: string) =>
  import.meta.env.DEV
    ? `${import.meta.env.BASE_URL}plugins/${name}/plugin.tsx`
    : `${import.meta.env.BASE_URL}assets/plugins/${name}.js`

const AVAILABLE_PLUGINS = [
  { name: 'HelloPlugin', src: pluginPath('hello-plugin') },
  { name: 'HelloWorldSui', src: pluginPath('hello-world-sui') },
  { name: 'SuiWallet', src: pluginPath('sui-wallet') },
  { name: 'SuiLink', src: pluginPath('sui-link') },
  { name: 'DualWallet', src: pluginPath('sui-dual-wallet') },
]

interface LoadedPlugin {
  plugin: Plugin
  componentNames: string[]
}

export function PluginDemoApp() {
  const [loaded, setLoaded] = useState<LoadedPlugin[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLoad = useCallback(
    async (src: string, name: string) => {
      // Don't load twice
      if (loaded.some((l) => l.plugin.name === name)) return

      setLoading(name)
      setError(null)

      const beforeComponents = new Set(getRegisteredComponents())

      try {
        const plugin = await loadPlugin(src)
        plugin.mount?.()

        const afterComponents = getRegisteredComponents()
        const newComponents = afterComponents.filter((c) => !beforeComponents.has(c))

        setLoaded((prev) => [...prev, { plugin, componentNames: newComponents }])
      } catch (err) {
        setError(`Failed to load ${name}: ${err}`)
      } finally {
        setLoading(null)
      }
    },
    [loaded],
  )

  const handleUnload = useCallback((name: string) => {
    setLoaded((prev) => {
      const target = prev.find((l) => l.plugin.name === name)
      if (target) {
        target.plugin.unmount?.()
        target.componentNames.forEach(unregisterComponent)
      }
      return prev.filter((l) => l.plugin.name !== name)
    })
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">🔌 Plugin Demo</h1>
        <p className="mt-2 text-zinc-400">Load and preview plugins dynamically via the Host API.</p>
      </header>

      {/* Available plugins */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Available Plugins</h2>
        <div className="flex flex-col gap-3">
          {AVAILABLE_PLUGINS.map(({ name, src }) => {
            const isLoaded = loaded.some((l) => l.plugin.name === name)
            const isLoading = loading === name

            return (
              <div
                key={name}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
              >
                <div>
                  <span className="font-mono text-sm">{name}</span>
                  <span className="ml-2 text-xs text-zinc-500">{src}</span>
                </div>
                {isLoaded ? (
                  <button
                    onClick={() => handleUnload(name)}
                    className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Unload
                  </button>
                ) : (
                  <button
                    onClick={() => handleLoad(src, name)}
                    disabled={isLoading}
                    className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoading ? 'Loading...' : 'Load'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {/* Loaded plugin components */}
      {loaded.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-300">Loaded Components</h2>
          <div className="flex flex-col gap-4">
            {loaded.map(({ plugin, componentNames }) =>
              componentNames.map((compName) => {
                const Comp = hostAPI.getComponent(compName)
                return (
                  <div
                    key={`${plugin.name}-${compName}`}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                      <span className="rounded bg-green-900 px-2 py-0.5 text-green-300">
                        {plugin.name} v{plugin.version}
                      </span>
                      <span className="font-mono">&lt;{compName} /&gt;</span>
                    </div>
                    {Comp ? (
                      <ShadowContainer styleUrls={plugin.styleUrls}>
                        <Comp />
                      </ShadowContainer>
                    ) : (
                      <span className="text-zinc-500">Component not found</span>
                    )}
                  </div>
                )
              }),
            )}
          </div>
        </section>
      )}

      {loaded.length === 0 && (
        <p className="text-center text-sm text-zinc-600">
          No plugins loaded yet. Click "Load" above to get started.
        </p>
      )}
    </div>
  )
}
