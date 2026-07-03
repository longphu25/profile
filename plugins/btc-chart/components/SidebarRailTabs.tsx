// BTC Chart — mobile rail section tabs (Setup, Funding, Context, Strategies).

import { cn } from '@/lib/utils'

export type MobileRailTab = 'setup' | 'funding' | 'context' | 'strategies'

export const MOBILE_RAIL_TABS: ReadonlyArray<{ id: MobileRailTab; label: string }> = [
  { id: 'setup', label: 'Setup' },
  { id: 'funding', label: 'Funding' },
  { id: 'context', label: 'Context' },
  { id: 'strategies', label: 'Strategies' },
]

export interface SidebarRailTabsProps {
  active: MobileRailTab
  onChange: (tab: MobileRailTab) => void
}

export function SidebarRailTabs({ active, onChange }: SidebarRailTabsProps) {
  return (
    <div className="btc-chart__rail-tabs" role="tablist" aria-label="Sidebar sections">
      {MOBILE_RAIL_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={cn('btc-chart__rail-tab', active === tab.id && 'is-active')}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
