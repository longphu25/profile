// BTC Chart — quick layer visibility presets for the tools drawer.

import type { VisFlags } from '../storage'
import { ALL_IND_KEYS } from './indicator-groups'

export type LayerPresetId = 'scalp' | 'swing' | 'analysis'

/** Layer keys enabled per preset (others turned off when applied). */
export const LAYER_PRESETS: Record<LayerPresetId, ReadonlyArray<keyof VisFlags>> = {
  scalp: ['of', 'volSpike', 'scalping', 'luxNwe', 'vol'],
  swing: ['ma50', 'ma200', 'vp', 'nwe', 'rsiDiv', 'vwap'],
  analysis: ['smc', 'supplyDemand', 'ict', 'liquidity', 'whale', 'vp', 'heatmap', 'boxFlip'],
}

export const LAYER_PRESET_LABELS: Record<LayerPresetId, string> = {
  scalp: 'Scalp',
  swing: 'Swing',
  analysis: 'Analysis',
}

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
