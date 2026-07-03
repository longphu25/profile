// BTC Chart — mobile sidebar rail tab ids and labels.

export type MobileRailTab = 'setup' | 'funding' | 'context' | 'strategies'

export const MOBILE_RAIL_TABS: ReadonlyArray<{ id: MobileRailTab; label: string }> = [
  { id: 'setup', label: 'Setup' },
  { id: 'funding', label: 'Funding' },
  { id: 'context', label: 'Context' },
  { id: 'strategies', label: 'Strategies' },
]
