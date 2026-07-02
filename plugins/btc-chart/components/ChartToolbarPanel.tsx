// BTC Chart — right tools panel (layers + toolbar actions).

import React, { useEffect } from 'react'
import type { NadarayaConfig, VisFlags } from '../storage'
import { ALL_IND_KEYS, IND_GROUPS, IND_LABELS } from '../lib/indicator-groups'
import { NweSettingsSection } from './NweSettingsSection'

export interface ChartToolbarPanelProps {
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggleGroup = (groupKeys: Array<keyof VisFlags>, enable: boolean) => {
    groupKeys.forEach((k) => {
      const on = !!vis[k]
      if (enable && !on) onToggle(k)
      if (!enable && on) onToggle(k)
    })
  }

  return (
    <div className="btc-chart__tools-overlay" role="presentation">
      <button
        type="button"
        className="btc-chart__tools-scrim"
        aria-label="Close tools panel"
        onClick={onClose}
      />
      <aside className="btc-chart__tools-panel" role="dialog" aria-label="Chart tools">
        <div className="btc-chart__tools-head">
          <div className="btc-chart__tools-title">
            <span className="btc-chart__tools-kicker">Chart</span>
            <span className="btc-chart__tools-name">Layers & Tools</span>
          </div>
          <span className="btc-chart__tools-count">
            <b>{activeCount}</b> layers on
          </span>
          <button
            type="button"
            className="btc-chart__tools-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="btc-chart__tools-body">
          <section className="btc-chart__tools-section">
            <div className="btc-chart__tools-section-head">
              <span className="btc-chart__tools-section-label">Layers</span>
              <div className="btc-chart__tools-section-actions">
                <button
                  type="button"
                  className="ind-panel-group__btn"
                  onClick={() => ALL_IND_KEYS.forEach((k) => !vis[k] && onToggle(k))}
                >
                  All on
                </button>
                <button
                  type="button"
                  className="ind-panel-group__btn"
                  onClick={() => ALL_IND_KEYS.forEach((k) => vis[k] && onToggle(k))}
                >
                  All off
                </button>
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
                      <button
                        type="button"
                        className={`ind-panel-group__btn${allOn ? ' is-on' : ''}`}
                        onClick={() => toggleGroup(keys, true)}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className="ind-panel-group__btn"
                        onClick={() => toggleGroup(keys, false)}
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="ind-panel-chips">
                    {keys.map((key) => {
                      const on = !!vis[key]
                      const locked = key === 'heatmap' && !vis.vp
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`ind-panel-chip${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}`}
                          disabled={locked}
                          title={locked ? 'Bật Vol Profile trước' : undefined}
                          aria-pressed={on}
                          onClick={() => onToggle(key)}
                        >
                          <span className="ind-panel-chip__dot" aria-hidden />
                          {IND_LABELS[key] || key}
                        </button>
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
              <button
                type="button"
                className={`btc-chart__tools-action${soundEnabled ? ' is-on' : ''}`}
                onClick={onToggleSound}
              >
                {soundEnabled ? 'Sound on' : 'Muted'}
              </button>
              <button
                type="button"
                className={`btc-chart__tools-action${notifAllowed ? ' is-on' : ''}`}
                onClick={onRequestNotif}
              >
                {notifAllowed ? 'Notifications' : 'Enable notif'}
              </button>
              <button type="button" className="btc-chart__tools-action" onClick={onSnapshot}>
                Save PNG
              </button>
              <button type="button" className="btc-chart__tools-action" onClick={onExport}>
                Export config
              </button>
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
          <button
            type="button"
            className="ind-panel-foot__btn ind-panel-foot__btn--primary"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </aside>
    </div>
  )
})
