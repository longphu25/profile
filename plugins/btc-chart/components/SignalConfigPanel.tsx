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
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
    <Card className="overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-3)]/40 border-b border-[var(--border)] cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mint)]"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
      >
        <span className="text-[var(--muted)]">{open ? '▾' : '▸'}</span>
        <span className="font-medium flex-1">Signal Config</span>
        <span className="text-[10px] text-[var(--muted)]">
          {activePreset ? activePreset.name : `${enabledCount}/${ALL_FEATURES.length}`}
        </span>
      </div>

      {open && (
        <div className="btc-chart__sigcfg-body">
          {/* Presets */}
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

          {/* Quick actions */}
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
    </Card>
  )
}
