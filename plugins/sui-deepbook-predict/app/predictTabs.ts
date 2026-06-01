import type { TabId } from '../domain'

export const PRIMARY_TABS = [
  'market',
  'portfolio',
  'trade',
  'vault',
] as const satisfies readonly TabId[]

export const ADVANCED_TABS = [
  { id: 'surface', label: '◊ Surface' },
  { id: 'risk', label: '⬡ Risk' },
  { id: 'strategy', label: '⬢ Strategy' },
  { id: 'plphedge', label: '⛨ PLP+Hedge' },
  { id: 'loop', label: '∞ Loop' },
  { id: 'arb', label: '⇄ Arb' },
  { id: 'lending', label: '⊕ Lending' },
  { id: 'spot', label: '⬡ Spot' },
  { id: 'keeper', label: '⚙ Keeper' },
] as const satisfies readonly { id: TabId; label: string }[]

export const PRIMARY_LABELS: Record<(typeof PRIMARY_TABS)[number], string> = {
  market: '◉ Market',
  portfolio: '◫ Portfolio',
  trade: '◇ Trade',
  vault: '◈ Vault',
}
