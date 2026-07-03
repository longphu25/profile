// BTC Chart — Signal config: choose indicators for ML signal + trade setup.

import { cn } from '@/lib/utils'
import {
  ALL_FEATURES,
  configFromPreset,
  FEATURE_GROUPS,
  FEATURE_NAMES,
  lookupSignalPreset,
  SIGNAL_PRESET_GROUPS,
  SIGNAL_PRESETS,
  type FeatureKey,
  type SignalConfig,
} from '../lib/signal-config'
import type { LayerPresetId } from '../lib/layer-presets'
import { LayerPresetGrid } from './LayerPresetGrid'

export interface SignalConfigBodyProps {
  config: SignalConfig
  onChange: (cfg: SignalConfig) => void
  /** Quick chart layer presets (Scalp / Swing / Analysis). */
  onApplyLayerPreset?: (preset: LayerPresetId) => void
}

/** Config form body (presets + feature toggles), embeddable in Signal block. */
export function SignalConfigBody({ config, onChange, onApplyLayerPreset }: SignalConfigBodyProps) {
  const enabledCount = ALL_FEATURES.filter((k) => config[k]).length
  const activePreset = SIGNAL_PRESETS.find(
    (p) =>
      p.features.length === enabledCount &&
      p.features.every((k) => config[k]) &&
      ALL_FEATURES.filter((k) => config[k]).every((k) => p.features.includes(k)),
  )

  const toggle = (key: FeatureKey) => {
    onChange({ ...config, [key]: !config[key] })
  }

  const applyPreset = (presetId: string) => {
    const preset = SIGNAL_PRESETS.find((p) => p.id === presetId)
    if (preset) onChange(configFromPreset(preset))
  }

  const selectAll = () => {
    onChange(Object.fromEntries(ALL_FEATURES.map((k) => [k, true])) as SignalConfig)
  }

  const clearAll = () => {
    onChange(Object.fromEntries(ALL_FEATURES.map((k) => [k, false])) as SignalConfig)
  }

  return (
    <div className="btc-chart__sigcfg-body">
      {onApplyLayerPreset && (
        <div className="btc-chart__sigcfg-section">
          <div className="btc-chart__sigcfg-section-head">
            <span className="btc-chart__sigcfg-section-label">Chart layers</span>
            <span className="btc-chart__sigcfg-section-hint">Nhấn để áp dụng</span>
          </div>
          <LayerPresetGrid onApply={onApplyLayerPreset} variant="compact" />
        </div>
      )}

      <div className="btc-chart__sigcfg-section">
        <div className="btc-chart__sigcfg-section-head">
          <span className="btc-chart__sigcfg-section-label">Chiến lược ML</span>
          <span className="btc-chart__sigcfg-section-hint">Theo nhóm</span>
        </div>
        {SIGNAL_PRESET_GROUPS.map((group) => (
          <div key={group.label} className="btc-chart__sigcfg-preset-group">
            <span className="btc-chart__sigcfg-grp-label">{group.label}</span>
            <div
              className="btc-chart__sigcfg-presets"
              role="group"
              aria-label={`Signal presets: ${group.label}`}
            >
              {group.presetIds.map((presetId) => {
                const p = lookupSignalPreset(presetId)
                if (!p) return null
                const isOn = activePreset?.id === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={cn('btc-chart__sigcfg-preset', isOn && 'is-on')}
                    onClick={() => applyPreset(p.id)}
                    title={p.description}
                    aria-pressed={isOn}
                  >
                    {p.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="btc-chart__sigcfg-actions" role="group" aria-label="Quick selection">
        <button type="button" onClick={selectAll}>
          Bật tất cả
        </button>
        <button type="button" onClick={clearAll}>
          Tắt tất cả
        </button>
        <span className="btc-chart__sigcfg-count">
          {enabledCount}/{ALL_FEATURES.length} chỉ báo
        </span>
      </div>

      {FEATURE_GROUPS.map((g) => (
        <div key={g.label} className="btc-chart__sigcfg-group">
          <span className="btc-chart__sigcfg-grp-label">{g.label}</span>
          <div className="btc-chart__sigcfg-items">
            {g.keys.map((k) => (
              <label key={k} className="btc-chart__sigcfg-item">
                <input type="checkbox" checked={config[k]} onChange={() => toggle(k)} />
                <span>{FEATURE_NAMES[k]}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

interface SignalConfigPanelProps extends SignalConfigBodyProps {}

/** @deprecated Prefer SignalConfigBody inside SignalPanel settings. */
export function SignalConfigPanel({ config, onChange }: SignalConfigPanelProps) {
  return <SignalConfigBody config={config} onChange={onChange} />
}
