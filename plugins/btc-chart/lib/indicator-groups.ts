// BTC Chart — indicator layer groups for the select panel.

import type { VisFlags } from '../storage'
import { WHALE_TRACKER_ENABLED } from './feature-flags'

/** Trade setup toggles (shown in a dedicated Tools section, not layer chips). */
export const TRADE_SETUP_LAYER_KEYS = [
  'tradeSetup',
  'tradeSetupOverlay',
] as const satisfies ReadonlyArray<keyof VisFlags>

/** MA line toggles (Tools panel section, not layer chips). */
export const MA_LINE_KEYS = ['maAdaptive', 'ma50', 'ma200'] as const satisfies ReadonlyArray<
  keyof VisFlags
>

export const IND_GROUPS: Record<string, Array<keyof VisFlags>> = {
  'Trend & Momentum': ['luxNwe', 'nwe', 'ma50', 'ma200', 'dbb', 'vwap'],
  'Smart Money (ICT/SMC)': ['smc', 'supplyDemand', 'ict', 'liquidity', 'boxFlip'],
  'Volume & Order Flow': ['of', 'vp', 'heatmap', 'vol', 'volSpike'],
  'Reversal & Signals': [
    'rsiDiv',
    'scalping',
    'reversal',
    ...(WHALE_TRACKER_ENABLED ? (['whale'] as const) : []),
  ],
}

export const IND_LABELS: Partial<Record<keyof VisFlags, string>> = {
  luxNwe: 'Lux NWE',
  nwe: 'MH Band',
  ma50: 'MA50',
  ma200: 'MA200',
  dbb: 'DBB',
  smc: 'SMC',
  supplyDemand: 'Supply & Demand',
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
  tradeSetup: 'Setup confluence',
  tradeSetupOverlay: 'Setup overlay',
  maAdaptive: 'EMA Adaptive',
}

export const MA_LINE_HINTS: Partial<Record<(typeof MA_LINE_KEYS)[number], string>> = {
  maAdaptive: 'EMA nhanh/chậm theo khung (9/21, 20/50, 50/200). Dùng cho bối cảnh Trade Setup.',
  ma50: 'SMA 50 cố định trên chart.',
  ma200: 'SMA 200 cố định trên chart.',
}

export const TRADE_SETUP_LAYER_HINTS: Record<(typeof TRADE_SETUP_LAYER_KEYS)[number], string> = {
  tradeSetup:
    'Bật thêm ICT, Boucher, Lien vào confluence. Lux + SMC đủ cho setup mặc định mà không cần toggle này.',
  tradeSetupOverlay: 'Vẽ vùng Entry, SL, TP trên chart. Tắt để giảm lag khi pan/zoom.',
}

export const ALL_IND_KEYS = [
  ...(Object.values(IND_GROUPS).flat() as Array<keyof VisFlags>),
  ...TRADE_SETUP_LAYER_KEYS,
  ...MA_LINE_KEYS.filter((k) => k === 'maAdaptive'),
]
