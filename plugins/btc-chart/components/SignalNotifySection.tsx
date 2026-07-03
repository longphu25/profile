// BTC Chart — Long/Short signal notification toggles (Tools panel).

import { cn } from '@/lib/utils'
import type { SignalNotifyConfig } from '../lib/signal-notify-config'

export interface SignalNotifySectionProps {
  cfg: SignalNotifyConfig
  notifAllowed: boolean
  onChange: (patch: Partial<SignalNotifyConfig>) => void
  onRequestNotif: () => void
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label
      className={cn('btc-chart__signotify-row', disabled && 'btc-chart__signotify-row--disabled')}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="btc-chart__signotify-row-text">
        <span className="btc-chart__signotify-row-label">{label}</span>
        {hint ? <span className="btc-chart__signotify-row-hint">{hint}</span> : null}
      </span>
    </label>
  )
}

/** Config toggles for ML + Trade Setup Long/Short browser notifications. */
export function SignalNotifySection({
  cfg,
  notifAllowed,
  onChange,
  onRequestNotif,
}: SignalNotifySectionProps) {
  const disabled = !cfg.enabled || !notifAllowed

  return (
    <section className="btc-chart__tools-section btc-chart__signotify">
      <div className="btc-chart__tools-section-head">
        <span className="btc-chart__tools-section-label">Tín hiệu Long/Short</span>
        {!notifAllowed ? (
          <button type="button" className="btc-chart__signotify-enable" onClick={onRequestNotif}>
            Bật thông báo
          </button>
        ) : null}
      </div>

      <ToggleRow
        label="Bật cảnh báo tín hiệu"
        hint="Áp dụng cho coin đang xem"
        checked={cfg.enabled}
        onChange={(on) => onChange({ enabled: on })}
      />

      <div className={cn('btc-chart__signotify-group', disabled && 'is-disabled')}>
        <span className="btc-chart__signotify-grp-title">ML Signal</span>
        <ToggleRow
          label="Long (ML)"
          hint={`Score ≥ ${(cfg.mlLongThreshold * 100).toFixed(0)}%`}
          checked={cfg.mlLong}
          disabled={disabled}
          onChange={(on) => onChange({ mlLong: on })}
        />
        <ToggleRow
          label="Short (ML)"
          hint={`Score ≤ ${(cfg.mlShortThreshold * 100).toFixed(0)}%`}
          checked={cfg.mlShort}
          disabled={disabled}
          onChange={(on) => onChange({ mlShort: on })}
        />
      </div>

      <div className={cn('btc-chart__signotify-group', disabled && 'is-disabled')}>
        <span className="btc-chart__signotify-grp-title">Trade Setup</span>
        <ToggleRow
          label="Bias Long"
          checked={cfg.setupBiasLong}
          disabled={disabled}
          onChange={(on) => onChange({ setupBiasLong: on })}
        />
        <ToggleRow
          label="Bias Short"
          checked={cfg.setupBiasShort}
          disabled={disabled}
          onChange={(on) => onChange({ setupBiasShort: on })}
        />
        <ToggleRow
          label="Plan Long"
          hint="Khi khóa entry trên nến đóng"
          checked={cfg.setupPlanLong}
          disabled={disabled}
          onChange={(on) => onChange({ setupPlanLong: on })}
        />
        <ToggleRow
          label="Plan Short"
          hint="Khi khóa entry trên nến đóng"
          checked={cfg.setupPlanShort}
          disabled={disabled}
          onChange={(on) => onChange({ setupPlanShort: on })}
        />
      </div>

      <p className="btc-chart__signotify-foot">
        Cooldown {Math.round(cfg.cooldownMs / 60_000)} phút mỗi loại tín hiệu. Cần bật Notifications
        ở Tools.
      </p>
    </section>
  )
}
