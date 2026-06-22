// BTC Chart — Alerts panel: create/list/toggle/remove price & indicator alerts.

import { useEffect, useState } from 'react'
import { type AlertRule, type AlertKind, describeRule } from '../alerts'
import { formatPriceShort } from '../lib'

export interface AlertsPanelProps {
  alerts: AlertRule[]
  onAdd: (kind: AlertKind, value: number, label?: string) => void
  onRemove: (id: string) => void
  onToggle: (id: string) => void
  onReset: (id: string) => void
  currentPrice: number | null
  currentRsi: number | null
}

export function AlertsPanel({
  alerts,
  onAdd,
  onRemove,
  onToggle,
  onReset,
  currentPrice,
  currentRsi,
}: AlertsPanelProps) {
  const [kind, setKind] = useState<AlertKind>('price-cross-up')
  const [val, setVal] = useState('')

  // Suggested default value when switching kind.
  useEffect(() => {
    if (kind === 'rsi-overbought') setVal('70')
    else if (kind === 'rsi-oversold') setVal('30')
    else if (kind === 'nwe-upper' || kind === 'nwe-lower') setVal('0')
    else if (currentPrice != null) setVal(String(Math.round(currentPrice)))
  }, [kind, currentPrice])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const numeric = Number(val)
    if (kind !== 'nwe-upper' && kind !== 'nwe-lower' && (!Number.isFinite(numeric) || numeric <= 0))
      return
    onAdd(kind, numeric || 0)
  }

  return (
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-title">Alerts</div>
      <form className="btc-chart__alert-form" onSubmit={submit}>
        <select
          className="btc-chart__alert-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as AlertKind)}
        >
          <option value="price-cross-up">Price ↑ crosses</option>
          <option value="price-cross-down">Price ↓ crosses</option>
          <option value="nwe-upper">Touch NWE Upper</option>
          <option value="nwe-lower">Touch NWE Lower</option>
          <option value="rsi-overbought">RSI overbought</option>
          <option value="rsi-oversold">RSI oversold</option>
        </select>
        {kind !== 'nwe-upper' && kind !== 'nwe-lower' && (
          <input
            className="btc-chart__alert-input"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={kind.startsWith('rsi') ? '70' : 'price'}
            aria-label="Threshold value"
          />
        )}
        <button type="submit" className="btc-chart__alert-add">
          Add
        </button>
      </form>

      {currentRsi != null && (
        <div className="btc-chart__alert-hint">
          RSI now <span>{currentRsi.toFixed(1)}</span>
          {currentPrice != null && (
            <>
              {' · '}
              <span>${formatPriceShort(currentPrice)}</span>
            </>
          )}
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="btc-chart__of-empty">Chưa có alert nào</div>
      ) : (
        <div className="btc-chart__alerts-list">
          {alerts.map((r) => (
            <div
              key={r.id}
              className={`btc-chart__alert${
                !r.enabled ? ' is-off' : r.triggeredAt ? ' is-fired' : ''
              }`}
            >
              <button
                type="button"
                className="btc-chart__alert-toggle"
                onClick={() => onToggle(r.id)}
                aria-label={r.enabled ? 'Disable' : 'Enable'}
                title={r.enabled ? 'Disable' : 'Enable'}
              >
                {r.enabled ? '●' : '○'}
              </button>
              <span className="btc-chart__alert-text">{describeRule(r)}</span>
              {r.triggeredAt > 0 ? (
                <button
                  type="button"
                  className="btc-chart__alert-mini"
                  onClick={() => onReset(r.id)}
                  title="Reset trigger"
                >
                  reset
                </button>
              ) : null}
              <button
                type="button"
                className="btc-chart__alert-del"
                onClick={() => onRemove(r.id)}
                aria-label="Delete alert"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
