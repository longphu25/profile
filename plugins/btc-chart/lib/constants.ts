// BTC Chart — UI palette, fetch limits, timeframes.

/** Locked chart palette — Meridian Tape warm obsidian. Change here to retune. */
export const CHART = {
  bg: '#080a0d',
  grid: 'rgba(232,184,74,0.04)',
  border: 'rgba(232,184,74,0.14)',
  axis: '#8a8f98',
  up: '#3dd68c',
  dn: '#f25757',
  neu: '#6fbcf0',
  hi: '#e8b84a',
  ma50: '#e8b84a',
  maFast: '#6fbcf0',
  maSlow: 'rgba(232,184,74,0.72)',
  vol: 'rgba(138,143,152,0.45)',
  upSoft: 'rgba(61,214,140,0.5)',
  dnSoft: 'rgba(242,87,87,0.5)',
} as const

export const LIMIT = 300

/** Polled ticker / header price cadence (ms). */
export const TICKER_REFRESH_MS = 2000

/** Chart pipeline + WebSocket render throttle (ms). */
export const CHART_REFRESH_MS = 2000

/** Minimum interval between heavy indicator recomputes on the same bar (ms). */
export const HEAVY_COMPUTE_MS = 5000

/** @deprecated Use TICKER_REFRESH_MS or CHART_REFRESH_MS */
export const LIVE_REFRESH_MS = CHART_REFRESH_MS

/** Default window size for heavy NWE computation (repaint mode benefits most from not using full history). */
export const NWE_DEFAULT_WINDOW = 500

export const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const
export type Interval = (typeof INTERVALS)[number]
