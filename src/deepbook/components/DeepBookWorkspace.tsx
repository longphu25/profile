import { useCallback, useEffect, useRef, useState } from 'react'
import { ShadowContainer } from '../../plugins/ShadowContainer'
import { suiHostAPI } from '../../sui-dashboard/sui-host'
import { NAV_GROUPS, type NavGroup } from '../config/nav'
import type { DeepBookPluginDef } from '../config/plugins'

interface DeepBookWorkspaceProps {
  activeGroup: NavGroup
  activePlugin: string
  activePluginDef: DeepBookPluginDef | undefined
  groupPlugins: DeepBookPluginDef[]
  onSelectPlugin: (id: string) => void
  children?: React.ReactNode
}

export function DeepBookWorkspace({
  activeGroup,
  activePlugin,
  activePluginDef,
  groupPlugins,
  onSelectPlugin,
  children,
}: DeepBookWorkspaceProps) {
  const [loaded, setLoaded] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const initRef = useRef<Set<string>>(new Set())

  const loadPlugin = useCallback(async (pluginDef: DeepBookPluginDef) => {
    if (initRef.current.has(pluginDef.id)) return
    initRef.current.add(pluginDef.id)

    try {
      const bustUrl = `${pluginDef.src}${pluginDef.src.includes('?') ? '&' : '?'}t=${Date.now()}`
      const module = await import(/* @vite-ignore */ bustUrl)
      const plugin = module.default
      if (!plugin?.name || !plugin?.init) throw new Error('Invalid plugin')
      plugin.init(suiHostAPI)
      plugin.mount?.()
      setLoaded((prev) => new Set(prev).add(pluginDef.id))
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [pluginDef.id]: err instanceof Error ? err.message : String(err),
      }))
    }
  }, [])

  useEffect(() => {
    if (activePluginDef) loadPlugin(activePluginDef)
  }, [activePluginDef, loadPlugin])

  const groupLabel = NAV_GROUPS.find((group) => group.id === activeGroup)?.label

  return (
    <>
      {activeGroup !== 'home' && activeGroup !== 'rewards' && (
        <aside className="hidden lg:flex flex-col gap-1 w-40 shrink-0 pt-1">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-2 px-2"
            style={{ color: 'var(--color-muted)' }}
          >
            {groupLabel}
          </p>
          {groupPlugins.map((plugin) => (
            <button
              type="button"
              key={plugin.id}
              onClick={() => onSelectPlugin(plugin.id)}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer text-left"
              style={{
                background: activePlugin === plugin.id ? 'rgba(128,255,213,0.1)' : 'transparent',
                color: activePlugin === plugin.id ? 'var(--color-mint)' : 'var(--color-muted)',
                border:
                  activePlugin === plugin.id
                    ? '1px solid rgba(128,255,213,0.18)'
                    : '1px solid transparent',
              }}
            >
              <span>{plugin.label}</span>
              {plugin.status === 'live' && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--color-mint)' }}
                />
              )}
            </button>
          ))}
        </aside>
      )}

      <div className="flex-1 min-w-0">
        {children ??
          (activePluginDef ? (
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
          ) : null)}
      </div>
    </>
  )
}
