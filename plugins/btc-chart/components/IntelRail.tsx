// BTC Chart — Intel sidebar rail with search + grouped tabs.

import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RailSection } from './sidebar'

export type IntelTab = 'trade' | 'market' | 'flow' | 'alerts' | 'ml'

export const INTEL_TABS: Array<{ id: IntelTab; label: string }> = [
  { id: 'trade', label: 'Trade' },
  { id: 'market', label: 'Market' },
  { id: 'flow', label: 'Flow' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'ml', label: 'ML' },
]

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
  return (
    <div
      className={`btc-chart__intel${mobileOpen ? ' is-mobile-open' : ''}`}
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
        <div className="btc-chart__intel-toolbar">
          <div className="btc-chart__intel-search">
            <Search className="btc-chart__intel-search-icon" aria-hidden />
            <Input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter panels…"
              aria-label="Filter intel panels"
              className="h-7 rounded-none border-[var(--border)] bg-[var(--surface-2)] pl-7 font-mono text-[10px] shadow-none"
            />
          </div>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v: string) => onTabChange(v as IntelTab)}
          className="btc-chart__intel-tabs"
        >
          <TabsList className="btc-chart__intel-tablist h-auto w-full justify-start rounded-none bg-transparent p-0">
            {INTEL_TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="btc-chart__intel-tab rounded-none px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider data-[state=active]:border-b-2 data-[state=active]:border-[var(--mint)] data-[state=active]:bg-[rgba(232,184,74,0.06)]"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {INTEL_TABS.map((t) => (
            <TabsContent key={t.id} value={t.id} className="btc-chart__intel-stack mt-0">
              {panels[t.id]}
            </TabsContent>
          ))}
        </Tabs>
      </RailSection>
    </div>
  )
}

/** Returns true when panel should render for the current intel search query. */
export function intelPanelVisible(title: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return title.toLowerCase().includes(q)
}