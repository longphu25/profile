// BTC Chart — indicator layer groups for the select panel.

import type { VisFlags } from '../storage'

export const IND_GROUPS: Record<string, Array<keyof VisFlags>> = {
  'Trend & Momentum': ['luxNwe', 'nwe', 'ma50', 'ma200', 'dbb', 'vwap'],
  'Smart Money (ICT/SMC)': ['smc', 'ict', 'liquidity', 'boxFlip'],
  'Volume & Order Flow': ['of', 'vp', 'heatmap', 'vol', 'volSpike'],
  'Reversal & Signals': ['rsiDiv', 'scalping', 'reversal', 'whale'],
}

export const IND_LABELS: Partial<Record<keyof VisFlags, string>> = {
  luxNwe: 'Lux NWE',
  nwe: 'MH Band',
  ma50: 'MA50',
  ma200: 'MA200',
  dbb: 'DBB',
  smc: 'SMC',
  ict: 'ICT Sessions',
  liquidity: 'Liquidity',
  boxFlip: 'Box Flip',
  of: 'Order Flow',
  vwap: 'VWAP',
  rsiDiv: 'RSI Div',
  scalping: 'Scalping',
  reversal: 'Reversal',
  whale: 'Whale',
  vp: 'Vol Profile',
  heatmap: 'Heatmap',
  vol: 'Volume',
  volSpike: 'Vol Spike',
}

export const ALL_IND_KEYS = Object.values(IND_GROUPS).flat() as Array<keyof VisFlags>
