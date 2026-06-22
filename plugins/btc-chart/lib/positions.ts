// BTC Chart — manual position tracking: types, persistence, PnL + liquidation.

export interface Position {
  id: string
  side: 'long' | 'short'
  type: 'isolated' | 'cross'
  entryPrice: number
  size: number // contracts / qty
  margin: number // USDT
  stopLoss: number | null
}

export interface PosForm {
  side: string
  type: string
  entry: string
  size: string
  margin: string
  sl: string
}

export const EMPTY_POS_FORM: PosForm = {
  side: 'long',
  type: 'isolated',
  entry: '',
  size: '',
  margin: '',
  sl: '',
}

const KEY = 'btc-chart:positions'

export function loadPositions(): Position[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function persistPositions(ps: Position[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ps))
  } catch {
    /* noop */
  }
}

/** Unrealized PnL (USDT) and percentage for a position at the given mark price. */
export function calcPnl(p: Position, mark: number): { pnl: number; pct: number } {
  const diff = p.side === 'long' ? mark - p.entryPrice : p.entryPrice - mark
  const pnl = (diff / p.entryPrice) * p.size * p.entryPrice
  const pct = (diff / p.entryPrice) * 100
  return { pnl, pct }
}

/** Approximate isolated-margin liquidation price (null for cross). */
export function calcLiquidation(p: Position): number | null {
  if (p.type !== 'isolated') return null
  return p.side === 'long'
    ? p.entryPrice * (1 - p.margin / (p.size * p.entryPrice))
    : p.entryPrice * (1 + p.margin / (p.size * p.entryPrice))
}
