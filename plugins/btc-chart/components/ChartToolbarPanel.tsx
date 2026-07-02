// BTC Chart — right tools panel (layers + toolbar actions).

import React, { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { NadarayaConfig, VisFlags } from '../storage'
import { ALL_IND_KEYS, IND_GROUPS, IND_LABELS } from '../lib/indicator-groups'
import { drawerPanel, drawerScrim, transitionDrawer } from '../lib/motion'
import { NweSettingsSection } from './NweSettingsSection'

export interface ChartToolbarPanelProps {
  open: boolean
  vis: VisFlags
  nweCfg: NadarayaConfig
  onToggle: (key: keyof VisFlags) => void
  onUpdateNweConfig: (patch: Partial<NadarayaConfig>) => void
  onClose: () => void
  soundEnabled: boolean
  onToggleSound: () => void
  notifAllowed: boolean
  onRequestNotif: () => void
  onSnapshot: () => void
  onExport: () => void
  onImport: (file: File) => void
}

export const ChartToolbarPanel = React.memo(function ChartToolbarPanel({
  open,
  vis,
  nweCfg,
  onToggle,
  onUpdateNweConfig,
  onClose,
  soundEnabled,
  onToggleSound,
  notifAllowed,
  onRequestNotif,
  onSnapshot,
  onExport,
  onImport,
}: ChartToolbarPanelProps) {
  const activeCount = ALL_IND_KEYS.filter((k) => vis[k]).length

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, open])

  const toggleGroup = (groupKeys: Array<keyof VisFlags>, enable: boolean) => {
    groupKeys.forEach((k) => {
      const on = !!vis[k]
      if (enable && !on) onToggle(k)
      if (!enable && on) onToggle(k)
    })
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="btc-chart__tools-overlay" role="presentation">
          <motion.button
            type="button"
            className="btc-chart__tools-scrim"
            aria-label="Close tools panel"
            onClick={onClose}
            variants={drawerScrim}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={transitionDrawer}
          />
          <motion.aside
            className="btc-chart__tools-panel"
            role="dialog"
            aria-label="Chart tools"
            variants={drawerPanel}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={transitionDrawer}
          >
            <div className="btc-chart__tools-head">
              <div className="btc-chart__tools-title">
                <span className="btc-chart__tools-kicker">Chart</span>
                <span className="btc-chart__tools-name">Layers & Tools</span>
              </div>
              <Badge
                variant="outline"
                className="btc-chart__tools-count rounded-none border-[var(--border)] bg-transparent font-mono text-[10px] tabular-nums"
              >
                <b>{activeCount}</b> layers on
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="btc-chart__tools-close h-8 w-8 rounded-none"
                onClick={onClose}
                aria-label="Close"
              >
                ×
              </Button>
            </div>

            <div className="btc-chart__tools-body">
              <section className="btc-chart__tools-section">
                <div className="btc-chart__tools-section-head">
                  <span className="btc-chart__tools-section-label">Layers</span>
                  <div className="btc-chart__tools-section-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ind-panel-group__btn h-6 rounded-none px-2 text-[9px]"
                      onClick={() => ALL_IND_KEYS.forEach((k) => !vis[k] && onToggle(k))}
                    >
                      All on
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ind-panel-group__btn h-6 rounded-none px-2 text-[9px]"
                      onClick={() => ALL_IND_KEYS.forEach((k) => vis[k] && onToggle(k))}
                    >
                      All off
                    </Button>
                  </div>
                </div>

                {Object.entries(IND_GROUPS).map(([groupName, keys]) => {
                  const onCount = keys.filter((k) => vis[k]).length
                  const allOn = onCount === keys.length
                  return (
                    <div key={groupName} className="ind-panel-group">
                      <div className="ind-panel-group__head">
                        <span className="ind-panel-group__title">{groupName}</span>
                        <span className="ind-panel-group__meta">
                          {onCount}/{keys.length}
                        </span>
                        <div className="ind-panel-group__actions">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'ind-panel-group__btn h-6 rounded-none px-2 text-[9px]',
                              allOn && 'is-on',
                            )}
                            onClick={() => toggleGroup(keys, true)}
                          >
                            All
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ind-panel-group__btn h-6 rounded-none px-2 text-[9px]"
                            onClick={() => toggleGroup(keys, false)}
                          >
                            None
                          </Button>
                        </div>
                      </div>
                      <div className="ind-panel-chips">
                        {keys.map((key) => {
                          const on = !!vis[key]
                          const locked = key === 'heatmap' && !vis.vp
                          return (
                            <Button
                              key={key}
                              type="button"
                              variant="ghost"
                              className={cn(
                                'ind-panel-chip h-auto rounded-none',
                                on && 'is-on',
                                locked && 'is-locked',
                              )}
                              disabled={locked}
                              title={locked ? 'Bật Vol Profile trước' : undefined}
                              aria-pressed={on}
                              onClick={() => onToggle(key)}
                            >
                              <span className="ind-panel-chip__dot" aria-hidden />
                              {IND_LABELS[key] || key}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </section>

              <section className="btc-chart__tools-section">
                <span className="btc-chart__tools-section-label">Tools</span>
                <div className="btc-chart__tools-grid">
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      'btc-chart__tools-action h-9 rounded-none',
                      soundEnabled && 'is-on',
                    )}
                    onClick={onToggleSound}
                  >
                    {soundEnabled ? 'Sound on' : 'Muted'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      'btc-chart__tools-action h-9 rounded-none',
                      notifAllowed && 'is-on',
                    )}
                    onClick={onRequestNotif}
                  >
                    {notifAllowed ? 'Notifications' : 'Enable notif'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="btc-chart__tools-action h-9 rounded-none"
                    onClick={onSnapshot}
                  >
                    Save PNG
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="btc-chart__tools-action h-9 rounded-none"
                    onClick={onExport}
                  >
                    Export config
                  </Button>
                  <label className="btc-chart__tools-action btc-chart__tools-action--file">
                    Import config
                    <input
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) onImport(f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </section>

              <NweSettingsSection cfg={nweCfg} onChange={onUpdateNweConfig} />
            </div>

            <div className="btc-chart__tools-foot">
              <Button
                type="button"
                className="ind-panel-foot__btn ind-panel-foot__btn--primary h-9 w-full rounded-none"
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
})
