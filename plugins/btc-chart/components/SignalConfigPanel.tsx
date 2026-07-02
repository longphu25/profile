// BTC Chart — Signal config: choose indicators for ML signal + trade setup.

import {
  SIGNAL_PRESETS,
  FEATURE_GROUPS,
  FEATURE_NAMES,
  ALL_FEATURES,
  configFromPreset,
  type SignalConfig,
  type FeatureKey,
} from '../lib'
import { Button } from '@/components/ui/button'

export interface SignalConfigBodyProps {
  config: SignalConfig
  onChange: (cfg: SignalConfig) => void
}

/** Config form body (presets + feature toggles), embeddable in Signal block. */
export function SignalConfigBody({ config, onChange }: SignalConfigBodyProps) {
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
      <div className="btc-chart__sigcfg-presets">
        {SIGNAL_PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant={activePreset?.id === p.id ? 'default' : 'outline'}
            size="sm"
            className="text-[10px] h-7"
            onClick={() => applyPreset(p.id)}
            title={p.description}
          >
            {p.name}
          </Button>
        ))}
      </div>

      <div className="flex gap-1 mt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-[10px] h-7"
          onClick={selectAll}
        >
          Bat tat ca
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-[10px] h-7"
          onClick={clearAll}
        >
          Tat tat ca
        </Button>
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
