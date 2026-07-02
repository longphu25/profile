// Site Builder — Drag & drop page builder using installed plugins
import { useState, useCallback } from 'react'
import type { DragEndEvent } from '@dnd-kit/react'
import { DragDropProvider } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { GripVertical, Trash2, Settings, Eye, Download, ChevronLeft, Sun, Moon } from 'lucide-react'
import type { PlacedPlugin, SitePage } from './types'
import { getPluginMeta } from './registry'
import { ShadowContainer } from '../plugins/ShadowContainer'
import { hostAPI } from '../plugins/host'

interface SiteBuilderProps {
  page: SitePage
  onPageChange: (page: SitePage) => void
  onOpenMarketplace: () => void
}

/** Sortable plugin card in the builder */
function SortablePluginCard({
  placed,
  index,
  onRemove,
  onConfigure,
}: {
  placed: PlacedPlugin
  index: number
  onRemove: () => void
  onConfigure: () => void
}) {
  const meta = getPluginMeta(placed.pluginId)
  const { ref } = useSortable({ id: placed.instanceId, index })

  return (
    <div
      ref={ref}
      className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 transition-all hover:border-zinc-600"
    >
      <div className="cursor-grab text-zinc-600 hover:text-zinc-400">
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="flex-1">
        <div className="text-sm font-medium text-zinc-200">{meta?.name ?? placed.pluginId}</div>
        <div className="text-xs text-zinc-500">{meta?.description}</div>
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onConfigure}
          className="cursor-pointer rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          title="Configure"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="cursor-pointer rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
          title="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function SiteBuilder({ page, onPageChange, onOpenMarketplace }: SiteBuilderProps) {
  const [previewMode, setPreviewMode] = useState(false)
  const [configuring, setConfiguring] = useState<string | null>(null)

  const handleRemove = useCallback(
    (instanceId: string) => {
      onPageChange({
        ...page,
        plugins: page.plugins.filter((p) => p.instanceId !== instanceId),
      })
    },
    [page, onPageChange],
  )

  const handleReorder = useCallback(
    (event: DragEndEvent) => {
      const operation = event.operation as {
        source?: { sortable?: { initialIndex?: number } } | null
        target?: { sortable?: { index?: number } } | null
      }
      const from = operation.source?.sortable?.initialIndex
      const to = operation.target?.sortable?.index
      if (from == null || to == null || from === to) return
      const reordered = [...page.plugins]
      const [item] = reordered.splice(from, 1)
      if (!item) return
      reordered.splice(to, 0, item)
      onPageChange({ ...page, plugins: reordered })
    },
    [page, onPageChange],
  )

  const toggleTheme = useCallback(() => {
    onPageChange({ ...page, theme: page.theme === 'dark' ? 'light' : 'dark' })
  }, [page, onPageChange])

  const handleExport = useCallback(() => {
    const pluginScripts = page.plugins
      .map((p) => {
        const meta = getPluginMeta(p.pluginId)
        return meta
          ? `  <div data-plugin="${p.pluginId}" data-config='${JSON.stringify(p.config)}'></div>`
          : ''
      })
      .filter(Boolean)
      .join('\n')

    const html = `<!DOCTYPE html>
<html lang="en" data-theme="${page.theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${page.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: ${page.theme === 'dark' ? '#09090b' : '#fafafa'}; color: ${page.theme === 'dark' ? '#e4e4e7' : '#18181b'}; }
    .plugin-container { max-width: 768px; margin: 0 auto; padding: 2rem 1rem; display: flex; flex-direction: column; gap: 1rem; }
  </style>
</head>
<body>
  <div class="plugin-container">
${pluginScripts}
  </div>
  <script src="https://cdn.yourplatform.com/loader.js"></script>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${page.slug || 'my-page'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }, [page])

  // ── Preview mode ──
  if (previewMode) {
    return (
      <div
        className={`min-h-screen ${page.theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'}`}
      >
        <div className="sticky top-0 z-50 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-4 py-2 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setPreviewMode(false)}
            className="flex cursor-pointer items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Editor
          </button>
          <span className="text-xs text-zinc-500">Preview — {page.title}</span>
        </div>

        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
          {page.plugins.map((placed) => {
            const meta = getPluginMeta(placed.pluginId)
            if (!meta) return null
            const Component = hostAPI.getComponent(meta.name)
            return (
              <div key={placed.instanceId} className="rounded-xl border border-zinc-800">
                {Component ? (
                  <ShadowContainer styleUrls={[`/plugins/${placed.pluginId}/style.css`]}>
                    <Component />
                  </ShadowContainer>
                ) : (
                  <div className="p-6 text-center text-sm text-zinc-500">
                    Plugin "{meta.name}" not loaded yet
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Editor mode ──
  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={page.title}
            onChange={(e) => onPageChange({ ...page, title: e.target.value })}
            className="border-b border-transparent bg-transparent text-lg font-semibold text-zinc-100 outline-none focus:border-blue-600"
            placeholder="Page Title"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="cursor-pointer rounded-lg border border-zinc-700 p-2 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
            title={`Switch to ${page.theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {page.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            <Download className="h-4 w-4" />
            Export HTML
          </button>
        </div>
      </div>

      {/* Plugin list (drag & drop) */}
      <div className="flex-1 overflow-y-auto p-4">
        {configuring && (
          <div className="mx-auto mb-3 max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
            Configuration panel for {configuring} is not implemented yet.
          </div>
        )}
        {page.plugins.length > 0 ? (
          <DragDropProvider onDragEnd={handleReorder}>
            <div className="mx-auto flex max-w-2xl flex-col gap-2">
              {page.plugins.map((placed, index) => (
                <SortablePluginCard
                  key={placed.instanceId}
                  placed={placed}
                  index={index}
                  onRemove={() => handleRemove(placed.instanceId)}
                  onConfigure={() => setConfiguring(placed.instanceId)}
                />
              ))}
            </div>
          </DragDropProvider>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <p className="mb-4 text-sm">No plugins added yet</p>
            <button
              type="button"
              onClick={onOpenMarketplace}
              className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              Browse Marketplace
            </button>
          </div>
        )}
      </div>

      {/* Floating add button */}
      {page.plugins.length > 0 && (
        <div className="border-t border-zinc-800 p-4">
          <button
            type="button"
            onClick={onOpenMarketplace}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-700 py-3 text-sm text-zinc-400 transition-colors hover:border-blue-600 hover:text-blue-400"
          >
            <span className="text-lg">+</span>
            Add Plugin from Marketplace
          </button>
        </div>
      )}
    </div>
  )
}
