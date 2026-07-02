// BTC Chart — oscillator bar with readout chips and tab controls.

import { motion } from 'motion/react'
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

function rsiLabel(v: number | null): { text: string; tone: string } {
  if (v == null) return { text: '—', tone: '' }
  if (v > 70) return { text: 'Quá mua', tone: 'osc-ob' }
  if (v < 30) return { text: 'Quá bán', tone: 'osc-os' }
  return { text: 'Trung tính', tone: '' }
}

function adxLabel(v: number | null): { text: string; tone: string } {
  if (v == null) return { text: '—', tone: '' }
  return v >= 25
    ? { text: 'Xu hướng mạnh', tone: 'osc-strong' }
    : { text: 'Sideway', tone: '' }
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
        />
      )}

      <div className="btc-chart__osc-bar">
        <button
          type="button"
          className="btc-chart__osc-toggle"
          onClick={onToggleOpen}
          aria-expanded={open}
        >
          <motion.span
            className="btc-chart__osc-caret"
            aria-hidden
            animate={{ rotate: open ? 90 : 0 }}
            transition={transitionSpring}
          >
            ▸
          </motion.span>
          Oscillators
        </button>

        <div className="btc-chart__osc-chips" role="list">
          <button
            type="button"
            className={cn('btc-chart__osc-chip', view === 'rsi' && 'is-active')}
            onClick={() => onViewChange('rsi')}
          >
            <span className="btc-chart__osc-chip-key">RSI</span>
            <span className="btc-chart__osc-chip-val">
              {readouts.rsi != null ? readouts.rsi.toFixed(1) : '—'}
            </span>
            <span className={cn('btc-chart__osc-chip-hint', rsi.tone)}>{rsi.text}</span>
          </button>
          <button
            type="button"
            className={cn('btc-chart__osc-chip', view === 'adx' && 'is-active')}
            onClick={() => onViewChange('adx')}
          >
            <span className="btc-chart__osc-chip-key">ADX</span>
            <span className="btc-chart__osc-chip-val">
              {readouts.adx != null ? readouts.adx.toFixed(1) : '—'}
            </span>
            <span className={cn('btc-chart__osc-chip-hint', adx.tone)}>{adx.text}</span>
          </button>
          <button
            type="button"
            className={cn('btc-chart__osc-chip', view === 'stoch' && 'is-active')}
            onClick={() => onViewChange('stoch')}
          >
            <span className="btc-chart__osc-chip-key">Stoch</span>
            <span className="btc-chart__osc-chip-val">
              {readouts.stochK != null ? readouts.stochK.toFixed(1) : '—'}
            </span>
            <span className={cn('btc-chart__osc-chip-hint', stoch.tone)}>{stoch.text}</span>
          </button>
          <button
            type="button"
            className={cn('btc-chart__osc-chip', view === 'obv' && 'is-active')}
            onClick={() => onViewChange('obv')}
          >
            <span className="btc-chart__osc-chip-key">OBV</span>
            <span className="btc-chart__osc-chip-val">
              {readouts.obv != null ? `${(readouts.obv / 1e6).toFixed(1)}M` : '—'}
            </span>
            <span className={cn('btc-chart__osc-chip-hint', obv.tone)}>{obv.text}</span>
          </button>
        </div>

        {open && (
          <div className="btc-chart__osc-tabs" role="tablist" aria-label="Oscillator view">
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