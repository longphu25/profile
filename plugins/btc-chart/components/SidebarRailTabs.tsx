// BTC Chart — mobile rail section tabs (Setup, Funding, Context, Strategies).

import { cn } from '@/lib/utils'
import { MOBILE_RAIL_TABS, type MobileRailTab } from '../lib/mobile-rail-tabs'

export type { MobileRailTab } from '../lib/mobile-rail-tabs'

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
