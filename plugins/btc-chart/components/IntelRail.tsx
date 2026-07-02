// BTC Chart — Intel sidebar rail with panel filter + grouped tabs.

import { useMemo, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  INTEL_TABS,
  INTEL_PANEL_CATALOG,
  intelVisiblePanelCount,
  type IntelTab,
} from '../lib/intel-panels'
import { RailSection } from './sidebar'

export type { IntelTab } from '../lib/intel-panels'
export { INTEL_TABS, intelPanelMatches, intelKeywordsFor } from '../lib/intel-panels'

export interface IntelRailProps {
  tab: IntelTab
  onTabChange: (tab: IntelTab) => void
  search: string
  onSearchChange: (q: string) => void
  panels: Record<IntelTab, ReactNode>
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function IntelRail({
  tab,
  onTabChange,
  search,
  onSearchChange,
  panels,
  mobileOpen = false,
  onMobileClose,
}: IntelRailProps) {
  const trimmed = search.trim()
  const tabDef = INTEL_TABS.find((t) => t.id === tab) ?? INTEL_TABS[0]
  const chips = INTEL_PANEL_CATALOG[tab]
  const totalPanels = chips.length
  const visiblePanels = intelVisiblePanelCount(tab, search)
  const isFiltering = trimmed.length > 0
  const noMatches = isFiltering && visiblePanels === 0

  const statusLine = useMemo(() => {
    if (noMatches) return 'Không có panel khớp'
    if (isFiltering) return `${visiblePanels} panel khớp trong tab ${tabDef.label}`
    if (totalPanels === 0) return tabDef.hint
    return `${totalPanels} panel · ${tabDef.hint}`
  }, [noMatches, isFiltering, visiblePanels, tabDef, totalPanels])

  return (
    <div
      className={cn('btc-chart__intel', mobileOpen && 'is-mobile-open')}
      role="region"
      aria-label="Intel panels"
    >
      {mobileOpen && (
        <button
          type="button"
          className="btc-chart__intel-scrim"
          aria-label="Close intel panel"
          onClick={onMobileClose}
        />
      )}

      <RailSection label="Intel">
        <div className="btc-chart__intel-filter">
          <div className="btc-chart__intel-filter-head">
            <span className="btc-chart__intel-filter-label">Tìm panel</span>
            {isFiltering && (
              <button
                type="button"
                className="btc-chart__intel-filter-clear"
                onClick={() => onSearchChange('')}
              >
                Xóa lọc
              </button>
            )}
          </div>

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
              placeholder="VD: whale, OI, volume, alerts…"
              aria-label="Tìm panel trong tab hiện tại"
            />
            {isFiltering && (
              <button
                type="button"
                className="btc-chart__intel-search-dismiss"
                onClick={() => onSearchChange('')}
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X size={12} strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>

          <p className={cn('btc-chart__intel-filter-status', noMatches && 'is-empty')}>
            {statusLine}
          </p>

          {chips.length > 0 && (
            <div className="btc-chart__intel-chips" role="group" aria-label="Lọc nhanh panel">
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

        <div className="btc-chart__intel-tabs" role="tablist" aria-label="Intel categories">
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

        <div className="btc-chart__intel-stack" role="tabpanel" aria-label={tabDef.label}>
          {noMatches ? (
            <div className="btc-chart__intel-no-match">
              <p className="btc-chart__intel-no-match-title">Không tìm thấy panel</p>
              <p className="btc-chart__intel-no-match-hint">
                Thử từ khóa khác hoặc chọn chip ở trên. Lọc chỉ áp dụng trong tab{' '}
                <strong>{tabDef.label}</strong>.
              </p>
              <button
                type="button"
                className="btc-chart__intel-no-match-btn"
                onClick={() => onSearchChange('')}
              >
                Hiện tất cả panel
              </button>
            </div>
          ) : (
            panels[tab]
          )}
        </div>
      </RailSection>
    </div>
  )
}
