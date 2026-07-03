// BTC Chart — oscillator bar with readout chips and tab controls.

import { m } from '../lib/btc-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { OscView } from '../storage'
import { transitionSpring } from '../lib/motion'

export interface OscReadouts {
  rsi: number | null
  adx: number | null
  stochK: number | null
  obv: number | null
}

export interface OscillatorPaneProps {
  open: boolean
  height?: number
  view: OscView
  readouts: OscReadouts
  oscElRef: React.RefObject<HTMLDivElement | null>
  onToggleOpen: () => void
  onViewChange: (view: OscView) => void
  onResizeStart: (e: React.PointerEvent) => void
}

const TABS: Array<{ id: OscView; label: string }> = [
  { id: 'rsi', label: 'RSI' },
  { id: 'adx', label: 'ADX' },
  { id: 'stoch', label: 'Stoch' },
  { id: 'obv', label: 'OBV' },
]

function formatOscValue(view: OscView, readouts: OscReadouts): string {
  switch (view) {
    case 'rsi':
      return readouts.rsi != null ? readouts.rsi.toFixed(1) : '—'
    case 'adx':
      return readouts.adx != null ? readouts.adx.toFixed(1) : '—'
    case 'stoch':
      return readouts.stochK != null ? readouts.stochK.toFixed(1) : '—'
    case 'obv':
      return readouts.obv != null ? `${(readouts.obv / 1e6).toFixed(1)}M` : '—'
    default:
      return '—'
  }
}

function hintForView(view: OscView, readouts: OscReadouts): { text: string; tone: string } {
  switch (view) {
    case 'rsi':
      return rsiLabel(readouts.rsi)
    case 'adx':
      return adxLabel(readouts.adx)
    case 'stoch':
      return stochLabel(readouts.stochK)
    case 'obv':
      return obvLabel(readouts.obv)
    default:
      return { text: '—', tone: '' }
  }
}

function rsiLabel(v: number | null): { text: string; tone: string } {
  if (v == null) return { text: '—', tone: '' }
  if (v > 70) return { text: 'Quá mua', tone: 'osc-ob' }
  if (v < 30) return { text: 'Quá bán', tone: 'osc-os' }
  return { text: 'Trung tính', tone: '' }
}

function adxLabel(v: number | null): { text: string; tone: string } {
  if (v == null) return { text: '—', tone: '' }
  return v >= 25 ? { text: 'Xu hướng mạnh', tone: 'osc-strong' } : { text: 'Sideway', tone: '' }
}

function stochLabel(v: number | null): { text: string; tone: string } {
  if (v == null) return { text: '—', tone: '' }
  if (v > 80) return { text: 'Quá mua', tone: 'osc-ob' }
  if (v < 20) return { text: 'Quá bán', tone: 'osc-os' }
  return { text: 'Trung tính', tone: '' }
}

function obvLabel(v: number | null): { text: string; tone: string } {
  if (v == null) return { text: '—', tone: '' }
  if (v > 0) return { text: 'Tích lũy', tone: 'osc-strong' }
  if (v < 0) return { text: 'Phân phối', tone: 'osc-ob' }
  return { text: '—', tone: '' }
}

export function OscillatorPane({
  open,
  height,
  view,
  readouts,
  oscElRef,
  onToggleOpen,
  onViewChange,
  onResizeStart,
}: OscillatorPaneProps) {
  const rsi = rsiLabel(readouts.rsi)
  const adx = adxLabel(readouts.adx)
  const stoch = stochLabel(readouts.stochK)
  const obv = obvLabel(readouts.obv)
  const activeTab = TABS.find((t) => t.id === view) ?? TABS[0]
  const activeHint = hintForView(view, readouts)

  return (
    <div
      className={cn('btc-chart__osc-wrap', open && 'is-open')}
      style={open && height ? { height } : undefined}
    >
      {open && (
        <div
          className="btc-chart__osc-resize"
          onPointerDown={onResizeStart}
          title="Kéo để chỉnh chiều cao"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Chỉnh chiều cao oscillators"
        />
      )}

      <div className="btc-chart__osc-bar">
        <button
          type="button"
          className="btc-chart__osc-toggle"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-label="Toggle oscillators panel"
        >
          <span className="btc-chart__osc-toggle-main">
            <m.span
              className="btc-chart__osc-caret"
              aria-hidden
              animate={{ rotate: open ? 90 : 0 }}
              transition={transitionSpring}
            >
              ▸
            </m.span>
            Oscillators
          </span>
          <span className="btc-chart__osc-active-summary" aria-hidden>
            <span className="btc-chart__osc-active-key">{activeTab.label}</span>
            <span className="btc-chart__osc-active-val">{formatOscValue(view, readouts)}</span>
            <span className={cn('btc-chart__osc-active-hint', activeHint.tone)}>
              {activeHint.text}
            </span>
          </span>
        </button>

        <ul className="btc-chart__osc-chips" aria-label="Oscillator metrics">
          {(
            [
              {
                id: 'rsi' as const,
                label: 'RSI',
                val: readouts.rsi,
                hint: rsi,
                fmt: (v: number) => v.toFixed(1),
              },
              {
                id: 'adx' as const,
                label: 'ADX',
                val: readouts.adx,
                hint: adx,
                fmt: (v: number) => v.toFixed(1),
              },
              {
                id: 'stoch' as const,
                label: 'Stoch',
                val: readouts.stochK,
                hint: stoch,
                fmt: (v: number) => v.toFixed(1),
              },
              {
                id: 'obv' as const,
                label: 'OBV',
                val: readouts.obv,
                hint: obv,
                fmt: (v: number) => `${(v / 1e6).toFixed(1)}M`,
              },
            ] as const
          ).map((chip) => {
            const display = chip.val != null ? chip.fmt(chip.val) : '—'
            return (
              <li key={chip.id}>
                <button
                  type="button"
                  className={cn('btc-chart__osc-chip', view === chip.id && 'is-active')}
                  onClick={() => onViewChange(chip.id)}
                  aria-pressed={view === chip.id}
                  aria-label={`${chip.label} ${display}, ${chip.hint.text}`}
                >
                  <span className="btc-chart__osc-chip-top">
                    <span className="btc-chart__osc-chip-key">{chip.label}</span>
                    <span className="btc-chart__osc-chip-val">{display}</span>
                  </span>
                  <span className={cn('btc-chart__osc-chip-hint', chip.hint.tone)}>
                    {chip.hint.text}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {open && (
          <div
            className="btc-chart__osc-tabs btc-chart__osc-tabs--desktop"
            role="tablist"
            aria-label="Oscillator view"
          >
            {TABS.map((t) => (
              <Button
                key={t.id}
                type="button"
                variant="ghost"
                size="sm"
                role="tab"
                aria-selected={view === t.id}
                className={cn(
                  'btc-chart__osc-tab h-7 rounded-none px-2.5 font-mono text-[9px]',
                  view === t.id && 'is-on',
                )}
                onClick={() => onViewChange(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="btc-chart__osc" ref={oscElRef} />
    </div>
  )
}
