// MarketplaceApp — Root component combining Marketplace + Site Builder
import { useState, useCallback } from 'react'
import { Store, LayoutPanelLeft, Blocks } from 'lucide-react'
import { Marketplace } from './Marketplace'
import { SiteBuilder } from './SiteBuilder'
import type { PluginMeta, SitePage, PlacedPlugin } from './types'

type View = 'builder' | 'marketplace'

const STORAGE_KEY = 'site-builder-page'

function loadSavedPage(): SitePage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    /* ignore */
  }
  return {
    title: 'My Profile',
    slug: 'my-profile',
    theme: 'dark',
    plugins: [],
  }
}

function savePage(page: SitePage) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(page))
}

export function MarketplaceApp() {
  const [view, setView] = useState<View>('builder')
  const [page, setPage] = useState<SitePage>(loadSavedPage)

  const installedIds = new Set(page.plugins.map((p) => p.pluginId))

  const handlePageChange = useCallback((updated: SitePage) => {
    setPage(updated)
    savePage(updated)
  }, [])

  const handleAddPlugin = useCallback(
    (plugin: PluginMeta) => {
      const placed: PlacedPlugin = {
        instanceId: `${plugin.id}-${Date.now()}`,
        pluginId: plugin.id,
        order: page.plugins.length,
        config: {},
      }
      const updated = { ...page, plugins: [...page.plugins, placed] }
      handlePageChange(updated)
      // Switch to builder after adding
      setView('builder')
    },
    [page, handlePageChange],
  )

  const handleRemovePlugin = useCallback(
    (pluginId: string) => {
      const updated = {
        ...page,
        plugins: page.plugins.filter((p) => p.pluginId !== pluginId),
      }
      handlePageChange(updated)
    },
    [page, handlePageChange],
  )

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Top nav */}
      <nav className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <Blocks className="h-5 w-5 text-blue-500" />
          <span className="text-sm font-semibold tracking-tight">Plugin Platform</span>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-zinc-900 p-1">
          <button
            onClick={() => setView('builder')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'builder' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LayoutPanelLeft className="h-3.5 w-3.5" />
            Builder
          </button>
          <button
            onClick={() => setView('marketplace')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'marketplace'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Store className="h-3.5 w-3.5" />
            Marketplace
            <span className="rounded-full bg-blue-600 px-1.5 text-[10px] text-white">
              {page.plugins.length > 0 ? page.plugins.length : ''}
            </span>
          </button>
        </div>

        <div className="text-xs text-zinc-500">
          {page.plugins.length} plugin{page.plugins.length !== 1 ? 's' : ''} added
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {view === 'builder' ? (
          <SiteBuilder
            page={page}
            onPageChange={handlePageChange}
            onOpenMarketplace={() => setView('marketplace')}
          />
        ) : (
          <Marketplace
            installedIds={installedIds}
            onAdd={handleAddPlugin}
            onRemove={handleRemovePlugin}
          />
        )}
      </main>
    </div>
  )
}
