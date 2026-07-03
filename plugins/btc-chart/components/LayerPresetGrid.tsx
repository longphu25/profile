// BTC Chart — clickable layer preset cards (Tools + Signal settings).

import { cn } from '@/lib/utils'
import {
  detectActiveLayerPreset,
  layerPresetsByGroup,
  type LayerPresetId,
} from '../lib/layer-presets'
import type { VisFlags } from '../storage'

export interface LayerPresetGridProps {
  onApply: (preset: LayerPresetId) => void
  /** When set, highlights the preset that matches current layer flags. */
  vis?: VisFlags
  variant?: 'tools' | 'compact'
}

/** Grouped preset buttons with label + hint (clearly clickable). */
export function LayerPresetGrid({ onApply, vis, variant = 'tools' }: LayerPresetGridProps) {
  const active = vis ? detectActiveLayerPreset(vis) : null
  const grouped = layerPresetsByGroup()

  return (
    <div
      className={cn(
        'btc-chart__preset-grid',
        variant === 'compact' && 'btc-chart__preset-grid--compact',
      )}
    >
      {grouped.map(({ group, label, presets }) => (
        <div key={group} className="btc-chart__preset-group">
          <span className="btc-chart__preset-group-label">{label}</span>
          <div
            className="btc-chart__preset-cards"
            role="group"
            aria-label={`Layer presets: ${label}`}
          >
            {presets.map((p) => {
              const isOn = active === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  className={cn('btc-chart__preset-card', isOn && 'is-active')}
                  onClick={() => onApply(p.id)}
                  title={p.hint}
                  aria-pressed={isOn}
                >
                  <span className="btc-chart__preset-card-name">{p.label}</span>
                  <span className="btc-chart__preset-card-hint">{p.hint}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
