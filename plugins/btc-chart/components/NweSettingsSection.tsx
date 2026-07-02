// BTC Chart — Lux NWE configuration block (inside tools panel).

import React from 'react'
import type { NadarayaConfig } from '../storage'
import { NWE_DEFAULT_WINDOW } from '../lib/constants'

export interface NweSettingsSectionProps {
  cfg: NadarayaConfig
  onChange: (patch: Partial<NadarayaConfig>) => void
}

export const NweSettingsSection = React.memo(function NweSettingsSection({
  cfg,
  onChange,
}: NweSettingsSectionProps) {
  return (
    <section className="btc-chart__tools-section btc-chart__tools-section--nwe">
      <span className="btc-chart__tools-section-label">Lux NWE</span>
      <div className="btc-chart__nwe-settings">
        <label className="btc-chart__nwe-setting-row">
          <input
            type="checkbox"
            checked={cfg.repaint}
            onChange={(e) => onChange({ repaint: e.target.checked })}
          />
          <span>
            Repaint mode
            <small>Chính xác hơn, nặng hơn</small>
          </span>
        </label>

        <div className="btc-chart__nwe-setting-field">
          <span className="btc-chart__nwe-setting-label">Bandwidth</span>
          <input
            type="number"
            className="btc-chart__nwe-input"
            value={cfg.bandwidth}
            min={2}
            max={24}
            step={1}
            onChange={(e) =>
              onChange({
                bandwidth: Math.max(2, Math.min(24, parseInt(e.target.value, 10) || cfg.bandwidth)),
              })
            }
          />
        </div>

        <div className="btc-chart__nwe-setting-field">
          <span className="btc-chart__nwe-setting-label">Multiplier</span>
          <input
            type="number"
            className="btc-chart__nwe-input"
            value={cfg.multiplier}
            min={1}
            max={6}
            step={0.5}
            onChange={(e) =>
              onChange({
                multiplier: Math.max(1, Math.min(6, parseFloat(e.target.value) || cfg.multiplier)),
              })
            }
          />
        </div>

        <div className="btc-chart__nwe-setting-field">
          <span className="btc-chart__nwe-setting-label">Window</span>
          <input
            type="number"
            className="btc-chart__nwe-input"
            value={cfg.maxBarsBack ?? NWE_DEFAULT_WINDOW}
            min={100}
            max={600}
            step={50}
            onChange={(e) =>
              onChange({
                maxBarsBack: Math.max(
                  100,
                  Math.min(600, parseInt(e.target.value, 10) || NWE_DEFAULT_WINDOW),
                ),
              })
            }
          />
          <span className="btc-chart__nwe-setting-hint">bars</span>
        </div>
      </div>
    </section>
  )
})
