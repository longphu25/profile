// BTC Chart — Alerts panel: create/list/toggle/remove price & indicator alerts.

import { useState } from 'react'
import { type AlertRule, type AlertKind, describeRule } from '../alerts'
import { formatPriceShort } from '../lib'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  const defaultThreshold = (nextKind: AlertKind, price: number | null): string => {
    if (nextKind === 'rsi-overbought') return '70'
    if (nextKind === 'rsi-oversold') return '30'
    if (nextKind === 'nwe-upper' || nextKind === 'nwe-lower') return '0'
    if (price != null) return String(Math.round(price))
    return ''
  }

  const [kind, setKind] = useState<AlertKind>('price-cross-up')
  const [val, setVal] = useState(() => defaultThreshold('price-cross-up', currentPrice))
  const [prevKind, setPrevKind] = useState(kind)
  const [prevPrice, setPrevPrice] = useState(currentPrice)

  if (kind !== prevKind) {
    setPrevKind(kind)
    setVal(defaultThreshold(kind, currentPrice))
  } else if (
    (kind === 'price-cross-up' || kind === 'price-cross-down') &&
    currentPrice !== prevPrice
  ) {
    setPrevPrice(currentPrice)
    if (currentPrice != null) setVal(String(Math.round(currentPrice)))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const numeric = Number(val)
    if (kind !== 'nwe-upper' && kind !== 'nwe-lower' && (!Number.isFinite(numeric) || numeric <= 0))
      return
    onAdd(kind, numeric || 0)
  }

  return (
    <Card className="p-3">
      <div className="text-sm font-medium mb-2">Alerts</div>
      <form className="space-y-2" onSubmit={submit}>
        <select
          className="input text-xs w-full bg-[var(--surface-3)] border border-[var(--border)] rounded px-2 py-1"
          value={kind}
          onChange={(e) => {
            const nextKind = e.target.value as AlertKind
            setKind(nextKind)
            setVal(defaultThreshold(nextKind, currentPrice))
          }}
        >
          <option value="price-cross-up">Price ↑ crosses</option>
          <option value="price-cross-down">Price ↓ crosses</option>
          <option value="nwe-upper">Touch NWE Upper</option>
          <option value="nwe-lower">Touch NWE Lower</option>
          <option value="rsi-overbought">RSI overbought</option>
          <option value="rsi-oversold">RSI oversold</option>
        </select>
        {kind !== 'nwe-upper' && kind !== 'nwe-lower' && (
          <Input
            className="text-xs h-8"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={kind.startsWith('rsi') ? '70' : 'price'}
            aria-label="Threshold value"
          />
        )}
        <Button type="submit" size="sm" className="w-full text-xs h-8">
          Add Alert
        </Button>
      </form>

      {currentRsi != null && (
        <div className="text-[10px] text-[var(--muted)] mt-2">
          RSI now <span className="text-[var(--text)]">{currentRsi.toFixed(1)}</span>
          {currentPrice != null && (
            <>
              {' · '}
              <span className="text-[var(--text)]">${formatPriceShort(currentPrice)}</span>
            </>
          )}
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="text-[10px] text-[var(--muted)] mt-2">Chưa có alert nào</div>
      ) : (
        <div className="mt-2 space-y-1">
          {alerts.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-2 text-xs p-1.5 rounded border border-[var(--border)] ${
                !r.enabled
                  ? 'opacity-50'
                  : r.triggeredAt
                    ? 'bg-[var(--dn)]/10 border-[var(--dn)]'
                    : ''
              }`}
            >
              <button
                type="button"
                onClick={() => onToggle(r.id)}
                className="text-[var(--mint)]"
                aria-label={r.enabled ? 'Disable' : 'Enable'}
                title={r.enabled ? 'Disable' : 'Enable'}
              >
                {r.enabled ? '●' : '○'}
              </button>
              <span className="flex-1 truncate">{describeRule(r)}</span>
              {r.triggeredAt > 0 ? (
                <button
                  type="button"
                  className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-3)] hover:bg-[var(--mint)] hover:text-ink"
                  onClick={() => onReset(r.id)}
                  title="Reset trigger"
                >
                  reset
                </button>
              ) : null}
              <button
                type="button"
                className="text-[var(--dn)] hover:text-[var(--mint)]"
                onClick={() => onRemove(r.id)}
                aria-label="Delete alert"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
