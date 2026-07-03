// BTC Chart — quick layer visibility presets for the tools drawer.

import type { VisFlags } from '../storage'
import { ALL_IND_KEYS } from './indicator-groups'
import { WHALE_TRACKER_ENABLED } from './feature-flags'

export type LayerPresetId =
  | 'minimal'
  | 'scalp'
  | 'swing'
  | 'trend'
  | 'smc'
  | 'ict'
  | 'analysis'
  | 'trade'
  | 'full'

export type LayerPresetGroup = 'light' | 'style' | 'advanced'

export interface LayerPresetMeta {
  readonly id: LayerPresetId
  readonly label: string
  readonly hint: string
  readonly group: LayerPresetGroup
}

/** Layer keys enabled per preset (others turned off when applied). */
export const LAYER_PRESETS: Record<LayerPresetId, ReadonlyArray<keyof VisFlags>> = {
  minimal: ['luxNwe'],
  scalp: ['of', 'volSpike', 'scalping', 'luxNwe', 'vol'],
  swing: ['ma50', 'ma200', 'vp', 'nwe', 'rsiDiv', 'vwap'],
  trend: ['ma50', 'ma200', 'vwap', 'luxNwe', 'rsiDiv', 'nwe'],
  smc: ['smc', 'supplyDemand', 'liquidity', 'boxFlip'],
  ict: ['ict', 'liquidity', 'luxNwe'],
  analysis: [
    'smc',
    'supplyDemand',
    'ict',
    'liquidity',
    ...(WHALE_TRACKER_ENABLED ? (['whale'] as const) : []),
    'vp',
    'heatmap',
    'boxFlip',
  ],
  trade: ['tradeSetup', 'tradeSetupOverlay', 'smc', 'ict', 'liquidity', 'luxNwe', 'supplyDemand'],
  full: ALL_IND_KEYS,
}

export const LAYER_PRESET_GROUP_LABELS: Record<LayerPresetGroup, string> = {
  light: 'Nhẹ',
  style: 'Phong cách',
  advanced: 'Nâng cao',
}

export const LAYER_PRESET_META: readonly LayerPresetMeta[] = [
  { id: 'minimal', label: 'Minimal', hint: 'Chỉ Lux NWE', group: 'light' },
  { id: 'scalp', label: 'Scalp', hint: 'OF, Vol, M1', group: 'style' },
  { id: 'swing', label: 'Swing', hint: 'MA, VP, RSI Div', group: 'style' },
  { id: 'trend', label: 'Trend', hint: 'MA, VWAP, NWE', group: 'style' },
  { id: 'smc', label: 'SMC', hint: 'S/D, Liquidity', group: 'advanced' },
  { id: 'ict', label: 'ICT', hint: 'Sessions, Liquidity', group: 'advanced' },
  { id: 'analysis', label: 'Analysis', hint: 'SMC + ICT đầy đủ', group: 'advanced' },
  { id: 'trade', label: 'Trade', hint: 'Setup + overlay', group: 'advanced' },
  { id: 'full', label: 'Full', hint: 'Tất cả layer', group: 'advanced' },
]

export const LAYER_PRESET_ORDER: readonly LayerPresetId[] = LAYER_PRESET_META.map((m) => m.id)

/** @deprecated Use {@link LAYER_PRESET_META} */
export const LAYER_PRESET_LABELS: Record<LayerPresetId, string> = Object.fromEntries(
  LAYER_PRESET_META.map((m) => [m.id, m.label]),
) as Record<LayerPresetId, string>

/**
 * Returns a new VisFlags with only preset layers on (heatmap requires vp).
 */
export function applyLayerPreset(current: VisFlags, preset: LayerPresetId): VisFlags {
  const on = new Set(LAYER_PRESETS[preset])
  const next = { ...current }
  for (const key of ALL_IND_KEYS) {
    next[key] = on.has(key)
  }
  if (next.heatmap && !next.vp) next.vp = true
  return next
}

/** True when every layer flag matches the preset exactly. */
export function detectActiveLayerPreset(vis: VisFlags): LayerPresetId | null {
  for (const id of LAYER_PRESET_ORDER) {
    const on = new Set(LAYER_PRESETS[id])
    const exact = ALL_IND_KEYS.every((k) => !!vis[k] === on.has(k))
    if (exact) return id
  }
  return null
}

/** Presets grouped for UI sections. */
export function layerPresetsByGroup(): ReadonlyArray<{
  readonly group: LayerPresetGroup
  readonly label: string
  readonly presets: readonly LayerPresetMeta[]
}> {
  const groups: LayerPresetGroup[] = ['light', 'style', 'advanced']
  return groups.map((group) => ({
    group,
    label: LAYER_PRESET_GROUP_LABELS[group],
    presets: LAYER_PRESET_META.filter((m) => m.group === group),
  }))
}
