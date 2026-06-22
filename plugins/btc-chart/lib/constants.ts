// BTC Chart — UI palette, fetch limits, timeframes.

/** Locked chart palette — aligned with TaskForm tokens. Change here to retune. */
export const CHART = {
  bg: '#071011',
  grid: 'rgba(190,255,234,0.05)',
  border: 'rgba(190,255,234,0.16)',
  axis: '#6f8a83',
  up: '#34d8a4',
  dn: '#ff7a85',
  neu: '#6fbcf0', // NWE mid + RSI
  hi: '#ffc46b', // POC + MA200
  ma50: '#80ffd5', // mint
  vol: 'rgba(159,185,177,0.5)',
  upSoft: 'rgba(52,216,164,0.55)',
  dnSoft: 'rgba(255,122,133,0.55)',
} as const

export const LIMIT = 300

export const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const
export type Interval = (typeof INTERVALS)[number]
