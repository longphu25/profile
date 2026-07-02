// BTC Chart — Lux NWE configuration block (inside tools panel).

import React from 'react'
import type { NadarayaConfig } from '../storage'
import { NWE_DEFAULT_WINDOW } from '../lib/constants'
import { parseBoundedFloat, parseBoundedInt } from '../lib/numeric-field'
import { NumericFieldInput } from './NumericFieldInput'

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
          <NumericFieldInput
            id="nwe-bandwidth"
            value={cfg.bandwidth}
            onChange={(bandwidth) => onChange({ bandwidth })}
            className="btc-chart__nwe-setting-input"
            inputClassName="btc-chart__nwe-input btc-chart__numeric-input"
            min={2}
            max={24}
            step={1}
            aria-label="NWE bandwidth"
            parse={(raw, fallback) => parseBoundedInt(raw, fallback, 2, 24)}
          />
        </div>

        <div className="btc-chart__nwe-setting-field">
          <span className="btc-chart__nwe-setting-label">Multiplier</span>
          <NumericFieldInput
            id="nwe-multiplier"
            value={cfg.multiplier}
            onChange={(multiplier) => onChange({ multiplier })}
            className="btc-chart__nwe-setting-input"
            inputClassName="btc-chart__nwe-input btc-chart__numeric-input"
            min={1}
            max={6}
            step={0.5}
            aria-label="NWE multiplier"
            parse={(raw, fallback) => parseBoundedFloat(raw, fallback, 1, 6)}
          />
        </div>

        <div className="btc-chart__nwe-setting-field">
          <span className="btc-chart__nwe-setting-label">Window</span>
          <NumericFieldInput
            id="nwe-window"
            value={cfg.maxBarsBack ?? NWE_DEFAULT_WINDOW}
            onChange={(maxBarsBack) => onChange({ maxBarsBack })}
            className="btc-chart__nwe-setting-input"
            inputClassName="btc-chart__nwe-input btc-chart__numeric-input"
            min={100}
            max={600}
            step={50}
            aria-label="NWE window bars"
            parse={(raw, fallback) => parseBoundedInt(raw, fallback, 100, 600)}
          />
          <span className="btc-chart__nwe-setting-hint">bars</span>
        </div>
      </div>
    </section>
  )
})
