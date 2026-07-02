import type { SymbolRoutingContext } from './types'

/** Default symbols refreshed by Convex cron (expand via env or Turso later). */
export const DEFAULT_CRON_SYMBOLS: readonly SymbolRoutingContext[] = [
  { symbol: 'BTCUSDT' },
  { symbol: 'ETHUSDT' },
  { symbol: 'SOLUSDT' },
  { symbol: 'SUIUSDT' },
  {
    symbol: 'OKBUSDT',
    okxInstId: 'OKB-USDT-SWAP',
  },
  {
    symbol: 'LABUSDT',
    mexcSymbol: 'LAB_USDT',
  },
] as const
