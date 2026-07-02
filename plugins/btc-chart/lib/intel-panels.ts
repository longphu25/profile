// BTC Chart — Intel rail panel catalog (filter chips, keywords, tab hints).

export type IntelTab = 'trade' | 'market' | 'flow' | 'alerts' | 'ml'

export interface IntelTabDef {
  id: IntelTab
  label: string
  hint: string
}

export interface IntelPanelDef {
  id: string
  title: string
  /** Short label on quick-filter chips */
  chip: string
  keywords: string[]
}

export const INTEL_TABS: IntelTabDef[] = [
  { id: 'trade', label: 'Trade', hint: 'Ghi chú quản lý vị thế (icon briefcase trên Trade Setup)' },
  {
    id: 'market',
    label: 'Market',
    hint: 'Open Interest, whale, thống kê 24h, Fear & Greed',
  },
  { id: 'flow', label: 'Flow', hint: 'Order flow, box flip, volume spike, volume profile' },
  { id: 'alerts', label: 'Alerts', hint: 'Tạo và quản lý cảnh báo giá / RSI' },
  { id: 'ml', label: 'ML', hint: 'MH Band, technicals, feature weights' },
]

export const INTEL_PANEL_CATALOG: Record<IntelTab, IntelPanelDef[]> = {
  trade: [
    {
      id: 'positions-hint',
      title: 'Vị thế thủ công',
      chip: 'Vị thế',
      keywords: ['position', 'vị thế', 'briefcase', 'trade', 'setup', 'manual'],
    },
  ],
  market: [
    {
      id: 'oi',
      title: 'Open Interest',
      chip: 'OI',
      keywords: ['oi', 'open', 'interest', 'mcap', 'liquidity'],
    },
    {
      id: 'whale',
      title: 'Whale Tracker',
      chip: 'Whale',
      keywords: ['whale', 'cá voi', 'flow', 'exchange', 'volume'],
    },
    {
      id: 'stats',
      title: '24h Stats',
      chip: '24h',
      keywords: ['stats', '24h', 'thống kê', 'volume', 'change'],
    },
    {
      id: 'fng',
      title: 'Fear & Greed',
      chip: 'F&G',
      keywords: ['fear', 'greed', 'fng', 'sentiment', 'tâm lý'],
    },
  ],
  flow: [
    {
      id: 'of',
      title: 'Order Flow',
      chip: 'Flow',
      keywords: ['order', 'flow', 'of', 'imbalance'],
    },
    {
      id: 'box',
      title: 'Box Flip',
      chip: 'Box',
      keywords: ['box', 'flip', 'breakout', 'range'],
    },
    {
      id: 'spike',
      title: 'Volume Spike',
      chip: 'Spike',
      keywords: ['spike', 'volume', 'vol', 'spike'],
    },
    {
      id: 'vp',
      title: 'Volume Profile',
      chip: 'VP',
      keywords: ['profile', 'vp', 'poc', 'vah', 'val', 'hvn'],
    },
  ],
  alerts: [
    {
      id: 'alerts',
      title: 'Alerts',
      chip: 'Alerts',
      keywords: ['alert', 'cảnh báo', 'price', 'rsi', 'notification'],
    },
  ],
  ml: [
    {
      id: 'mh',
      title: 'MH Band',
      chip: 'MH',
      keywords: ['mh', 'band', 'nwe', 'midnight', 'hunter'],
    },
    {
      id: 'tech',
      title: 'Technicals',
      chip: 'Tech',
      keywords: ['technical', 'rsi', 'macd', 'adx', 'indicator'],
    },
    {
      id: 'weights',
      title: 'Feature Weights',
      chip: 'Weights',
      keywords: ['feature', 'weight', 'ml', 'model'],
    },
  ],
}

/** Keywords for a panel title within a tab (for SidebarAccordion filter). */
export function intelKeywordsFor(tab: IntelTab, title: string): string[] {
  return INTEL_PANEL_CATALOG[tab].find((p) => p.title === title)?.keywords ?? []
}

/** True when query matches panel title or any keyword (all tokens must match). */
export function intelPanelMatches(
  title: string,
  keywords: string[] | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [title, ...(keywords ?? [])].join(' ').toLowerCase()
  return q.split(/\s+/).every((token) => haystack.includes(token))
}

/** Count panels in tab that match the current filter query. */
export function intelVisiblePanelCount(tab: IntelTab, query: string): number {
  return INTEL_PANEL_CATALOG[tab].filter((p) => intelPanelMatches(p.title, p.keywords, query))
    .length
}
