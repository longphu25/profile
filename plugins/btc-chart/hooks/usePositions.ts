// BTC Chart — position state, persistence, and chart price-line side effect.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from 'react'
import type { ChartRefs } from '../lib/types'
import {
  type Position,
  type PosForm,
  EMPTY_POS_FORM,
  loadPositions,
  persistPositions,
} from '../lib/positions'

export type PositionPatch = Partial<
  Pick<Position, 'stopLoss' | 'entryPrice' | 'margin' | 'leverage' | 'side' | 'type'>
>

export interface UsePositions {
  positions: Position[]
  showForm: boolean
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>
  form: PosForm
  setForm: React.Dispatch<React.SetStateAction<PosForm>>
  addPosition: () => void
  removePosition: (id: string) => void
  updatePosition: (id: string, patch: PositionPatch) => void
}

/**
 * Owns the manual-positions list, its add/remove form state, and the chart
 * entry/stop-loss price-line overlay that stays in sync with the positions.
 */
export function usePositions(
  chartRefs: React.MutableRefObject<ChartRefs | null>,
  chartReady?: boolean,
  markPrice?: number | null,
): UsePositions {
  const [positions, setPositions] = useState<Position[]>(loadPositions)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PosForm>(EMPTY_POS_FORM)

  const save = (ps: Position[]) => {
    setPositions(ps)
    persistPositions(ps)
  }

  const addPosition = () => {
    const entry = parseFloat(form.entry)
    const margin = parseFloat(form.margin) || 10
    const leverage = parseFloat(form.leverage) || 10
    if (!entry) return
    const notional = margin * leverage
    const size = notional / entry
    const p: Position = {
      id: Date.now().toString(),
      side: form.side as 'long' | 'short',
      type: form.type as 'isolated' | 'cross',
      entryPrice: entry,
      size,
      margin,
      leverage,
      stopLoss: form.sl ? parseFloat(form.sl) : null,
    }
    save([...positions, p])
    setForm(EMPTY_POS_FORM)
    setShowForm(false)
  }

  const removePosition = (id: string) => save(positions.filter((x) => x.id !== id))

  const updatePosition = (id: string, patch: PositionPatch) => {
    save(
      positions.map((p) => {
        if (p.id !== id) return p
        const entryPrice = patch.entryPrice ?? p.entryPrice
        const margin = patch.margin ?? p.margin
        const leverage = patch.leverage ?? p.leverage
        const size =
          patch.entryPrice != null || patch.margin != null || patch.leverage != null
            ? (margin * leverage) / entryPrice
            : p.size
        return {
          ...p,
          ...patch,
          entryPrice,
          margin,
          leverage,
          size,
        }
      }),
    )
  }

  // Draw entry + PnL price line on the chart whenever positions change.
  const posLinesRef = useRef<{ id: string; lines: any[] }[]>([])
  useEffect(() => {
    const series = chartRefs.current?.candleSeries
    if (!series) return
    for (const entry of posLinesRef.current) {
      for (const ln of entry.lines) {
        try {
          series.removePriceLine(ln)
        } catch {
          /* noop */
        }
      }
    }
    posLinesRef.current = []
    for (const p of positions) {
      const lines: any[] = []
      const mark = markPrice ?? p.entryPrice
      const diff = p.side === 'long' ? mark - p.entryPrice : p.entryPrice - mark
      const pnl = diff * p.size
      const pnlStr = `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}$`
      lines.push(
        series.createPriceLine({
          price: p.entryPrice,
          color: p.side === 'long' ? '#34d8a4' : '#ff7a85',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `${p.side.toUpperCase()} ${pnlStr}`,
        }),
      )
      if (p.stopLoss) {
        lines.push(
          series.createPriceLine({
            price: p.stopLoss,
            color: '#ffc46b',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'SL',
          }),
        )
      }
      posLinesRef.current.push({ id: p.id, lines })
    }
  }, [positions, chartRefs, chartReady, markPrice])

  return {
    positions,
    showForm,
    setShowForm,
    form,
    setForm,
    addPosition,
    removePosition,
    updatePosition,
  }
}
