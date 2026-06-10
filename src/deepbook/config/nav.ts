export type NavGroup =
  | 'home'
  | 'trade'
  | 'predict'
  | 'portfolio'
  | 'earn'
  | 'bots'
  | 'rewards'
  | 'advanced'

export interface NavGroupDef {
  id: NavGroup
  label: string
  icon: string
}

export const NAV_GROUPS: NavGroupDef[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'trade', label: 'Trade', icon: '⇄' },
  { id: 'predict', label: 'Predict', icon: '◇' },
  { id: 'portfolio', label: 'Portfolio', icon: '◫' },
  { id: 'earn', label: 'Earn', icon: '▲' },
  { id: 'bots', label: 'Bots', icon: '⚙' },
  { id: 'rewards', label: 'Rewards', icon: '★' },
  { id: 'advanced', label: 'Advanced', icon: '◊' },
]
