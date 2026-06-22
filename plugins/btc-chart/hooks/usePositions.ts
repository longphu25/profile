// BTC Chart — position state, persistence, and chart price-line side effect.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from 'react'
import {
  type ChartRefs,
  type Position,
  type PosForm,
  EMPTY_POS_FORM,
  loadPositions,
  persistPositions,
} from '../lib'

export interface UsePositions {
  positions: Position[]
  showForm: boolean
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>
  form: PosForm
  setForm: React.Dispatch<React.SetStateAction<PosForm>>
  addPosition: () => void
  removePosition: (id: string) => void
}

/**
 * Owns the manual-positions list, its add/remove form state, and the chart
 * entry/stop-loss price-line overlay that stays in sync with the positions.
 */
export function usePositions(chartRefs: React.MutableRefObject<ChartRefs | null>): UsePositions {
  const [positions, setPositions] = useState<Position[]>(loadPositions)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PosForm>(EMPTY_POS_FORM)

  const save = (ps: Position[]) => {
    setPositions(ps)
    persistPositions(ps)
  }

  const addPosition = () => {
    const entry = parseFloat(form.entry)
    const size = parseFloat(form.size)
    const margin = parseFloat(form.margin)
    if (!entry || !size || !margin) return
    const p: Position = {
      id: Date.now().toString(),
      side: form.side as 'long' | 'short',
      type: form.type as 'isolated' | 'cross',
      entryPrice: entry,
      size,
      margin,
      stopLoss: form.sl ? parseFloat(form.sl) : null,
    }
    save([...positions, p])
    setForm(EMPTY_POS_FORM)
    setShowForm(false)
  }

  const removePosition = (id: string) => save(positions.filter((x) => x.id !== id))

  // Draw entry + SL price lines on the chart whenever positions change.
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
      lines.push(
        series.createPriceLine({
          price: p.entryPrice,
          color: p.side === 'long' ? '#34d8a4' : '#ff7a85',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `${p.side.toUpperCase()} ${p.type} ${p.size}`,
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
  }, [positions, chartRefs])

  return { positions, showForm, setShowForm, form, setForm, addPosition, removePosition }
}
