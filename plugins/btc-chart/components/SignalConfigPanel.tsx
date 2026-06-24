// BTC Chart — Signal Config Panel: choose indicators for ML signal + trade setup

import { useState } from 'react'
import {
  SIGNAL_PRESETS,
  FEATURE_GROUPS,
  FEATURE_NAMES,
  ALL_FEATURES,
  configFromPreset,
  type SignalConfig,
  type FeatureKey,
} from '../lib'

interface Props {
  config: SignalConfig
  onChange: (cfg: SignalConfig) => void
}

export function SignalConfigPanel({ config, onChange }: Props) {
  const [open, setOpen] = useState(false)

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
    <div className="btc-chart__panel btc-chart__sigcfg">
      <button
        type="button"
        className="btc-chart__sigcfg-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="btc-chart__sigcfg-caret">{open ? '▾' : '▸'}</span>
        Signal Config
        <span className="muted">
          {activePreset ? activePreset.name : `${enabledCount}/${ALL_FEATURES.length}`}
        </span>
      </button>

      {open && (
        <div className="btc-chart__sigcfg-body">
          {/* Presets */}
          <div className="btc-chart__sigcfg-presets">
            {SIGNAL_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btc-chart__sigcfg-preset${activePreset?.id === p.id ? ' is-on' : ''}`}
                onClick={() => applyPreset(p.id)}
                title={p.description}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Quick actions */}
          <div className="btc-chart__sigcfg-actions">
            <button type="button" onClick={selectAll}>
              Bat tat ca
            </button>
            <button type="button" onClick={clearAll}>
              Tat tat ca
            </button>
          </div>

          {/* Feature toggles by group */}
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
      )}
    </div>
  )
}
