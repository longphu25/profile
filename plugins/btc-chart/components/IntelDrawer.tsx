// BTC Chart — Intel panels in a right slide-over (flat list, no nested rails).

import { useEffect, useEffectEvent, useMemo, type ReactNode } from 'react'
import { AnimatePresence, m } from '../lib/btc-motion'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { drawerPanel, drawerScrim, transitionDrawer } from '../lib/motion'
import {
  INTEL_TABS,
  INTEL_PANEL_CATALOG,
  intelVisiblePanelCount,
  type IntelTab,
} from '../lib/intel-panels'

export interface IntelDrawerProps {
  open: boolean
  onClose: () => void
  tab: IntelTab
  onTabChange: (tab: IntelTab) => void
  search: string
  onSearchChange: (q: string) => void
  children: ReactNode
}

export function IntelDrawer({
  open,
  onClose,
  tab,
  onTabChange,
  search,
  onSearchChange,
  children,
}: IntelDrawerProps) {
  const trimmed = search.trim()
  const tabDef = INTEL_TABS.find((t) => t.id === tab) ?? INTEL_TABS[0]
  const chips = INTEL_PANEL_CATALOG[tab]
  const visiblePanels = intelVisiblePanelCount(tab, search)
  const isFiltering = trimmed.length > 0
  const noMatches = isFiltering && visiblePanels === 0

  const statusLine = useMemo(() => {
    if (noMatches) return 'Không có panel khớp'
    if (isFiltering) return `${visiblePanels} panel khớp`
    return tabDef.hint
  }, [noMatches, isFiltering, visiblePanels, tabDef])

  const handleClose = useEffectEvent(() => {
    onClose()
  })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.button
            type="button"
            className="btc-chart__intel-scrim"
            aria-label="Đóng Intel"
            onClick={onClose}
            variants={drawerScrim}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={transitionDrawer}
          />

          <m.aside
            className="btc-chart__intel-drawer is-open"
            role="dialog"
            aria-modal="true"
            aria-label="Intel panels"
            variants={drawerPanel}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={transitionDrawer}
          >
            <header className="btc-chart__intel-drawer-head">
              <div>
                <h2 className="btc-chart__intel-drawer-title">Intel</h2>
                <p className="btc-chart__intel-drawer-sub">Panel phân tích bổ sung</p>
              </div>
              <button
                type="button"
                className="btc-chart__intel-drawer-close"
                onClick={onClose}
                aria-label="Đóng"
              >
                <X size={16} strokeWidth={2} aria-hidden />
              </button>
            </header>

            <div className="btc-chart__intel-tabs" role="tablist" aria-label="Nhóm panel">
              {INTEL_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={cn('btc-chart__intel-tab', tab === t.id && 'is-active')}
                  onClick={() => onTabChange(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="btc-chart__intel-filter btc-chart__intel-filter--drawer">
              <div className="btc-chart__intel-search">
                <Search
                  className="btc-chart__intel-search-icon"
                  aria-hidden
                  size={12}
                  strokeWidth={2}
                />
                <input
                  type="search"
                  className="btc-chart__intel-search-input"
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={`Tìm trong ${tabDef.label}…`}
                  aria-label="Tìm panel"
                />
                {isFiltering && (
                  <button
                    type="button"
                    className="btc-chart__intel-search-dismiss"
                    onClick={() => onSearchChange('')}
                    aria-label="Xóa tìm kiếm"
                  >
                    <X size={12} strokeWidth={2} aria-hidden />
                  </button>
                )}
              </div>

              <p className={cn('btc-chart__intel-filter-status', noMatches && 'is-empty')}>
                {statusLine}
              </p>

              {chips.length > 0 && (
                <div className="btc-chart__intel-chips" role="group" aria-label="Lọc nhanh">
                  <button
                    type="button"
                    className={cn('btc-chart__intel-chip', !isFiltering && 'is-on')}
                    onClick={() => onSearchChange('')}
                  >
                    Tất cả
                  </button>
                  {chips.map((p) => {
                    const active = trimmed.toLowerCase() === p.title.toLowerCase()
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={cn('btc-chart__intel-chip', active && 'is-on')}
                        onClick={() => onSearchChange(active ? '' : p.title)}
                        title={p.title}
                      >
                        {p.chip}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="btc-chart__intel-drawer-body" role="tabpanel" aria-label={tabDef.label}>
              {noMatches ? (
                <div className="btc-chart__intel-no-match">
                  <p className="btc-chart__intel-no-match-title">Không tìm thấy panel</p>
                  <p className="btc-chart__intel-no-match-hint">
                    Thử chip hoặc từ khóa khác trong tab {tabDef.label}.
                  </p>
                  <button
                    type="button"
                    className="btc-chart__intel-no-match-btn"
                    onClick={() => onSearchChange('')}
                  >
                    Hiện tất cả
                  </button>
                </div>
              ) : (
                <div className="btc-chart__intel-panel-list" key={tab}>
                  {children}
                </div>
              )}
            </div>
          </m.aside>
        </>
      )}
    </AnimatePresence>
  )
}
