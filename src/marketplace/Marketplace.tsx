// Plugin Marketplace — Browse, search, and add plugins
import { useState, useMemo } from 'react'
import { Search, Filter, Plus, Check, ExternalLink } from 'lucide-react'
import { PLUGIN_REGISTRY } from './registry'
import { CATEGORY_LABELS, type PluginCategory, type PluginMeta } from './types'

interface MarketplaceProps {
  /** IDs of plugins already installed/added */
  installedIds: Set<string>
  /** Called when user clicks "Add" on a plugin */
  onAdd: (plugin: PluginMeta) => void
  /** Called when user clicks "Remove" on an installed plugin */
  onRemove?: (pluginId: string) => void
}

const categories = Object.entries(CATEGORY_LABELS) as [PluginCategory, string][]

export function Marketplace({ installedIds, onAdd, onRemove }: MarketplaceProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<PluginCategory | 'all'>('all')

  const filtered = useMemo(() => {
    let results = PLUGIN_REGISTRY
    if (activeCategory !== 'all') {
      results = results.filter((p) => p.category === activeCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.includes(q)),
      )
    }
    return results
  }, [search, activeCategory])

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 backdrop-blur-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search plugins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-blue-600"
          />
        </div>

        {/* Category filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            }`}
          >
            <Filter className="mr-1 inline-block h-3 w-3" />
            All ({PLUGIN_REGISTRY.length})
          </button>
          {categories.map(([key, label]) => {
            const count = PLUGIN_REGISTRY.filter((p) => p.category === key).length
            return (
              <button
                type="button"
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeCategory === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                }`}
              >
                {label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Plugin grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((plugin) => {
            const isInstalled = installedIds.has(plugin.id)
            return (
              <div
                key={plugin.id}
                className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-600 hover:bg-zinc-900"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">{plugin.name}</h3>
                    <span className="mt-0.5 inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                      {CATEGORY_LABELS[plugin.category]}
                    </span>
                  </div>
                  {plugin.requiresSui && (
                    <span className="rounded bg-cyan-900/50 px-1.5 py-0.5 text-[10px] font-medium text-cyan-400">
                      SUI
                    </span>
                  )}
                </div>

                <p className="mb-3 flex-1 text-xs leading-relaxed text-zinc-400">
                  {plugin.description}
                </p>

                <div className="mb-3 flex flex-wrap gap-1">
                  {plugin.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {isInstalled ? (
                    <>
                      <button
                        type="button"
                        disabled
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-900/30 py-1.5 text-xs font-medium text-green-400"
                      >
                        <Check className="h-3 w-3" />
                        Added
                      </button>
                      {onRemove && (
                        <button
                          type="button"
                          onClick={() => onRemove(plugin.id)}
                          className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-red-800 hover:text-red-400"
                        >
                          Remove
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAdd(plugin)}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-blue-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
                    >
                      <Plus className="h-3 w-3" />
                      Add to Page
                    </button>
                  )}
                  <button
                    type="button"
                    className="cursor-pointer rounded-lg border border-zinc-700 p-1.5 text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
                    title="Preview plugin"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="py-20 text-center text-sm text-zinc-500">
            No plugins found for "{search}"
          </div>
        )}
      </div>
    </div>
  )
}
