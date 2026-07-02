// BTC Chart — Positions panel: add-form with capital/leverage, PnL display.

import { useEffect } from 'react'
import { type Position, type PosForm, calcLiquidation, calcPnl, fmtP } from '../lib'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

export interface PosSuggestion {
  sl: number
  tp1: number
  tp2: number
}

export interface PositionsPanelProps {
  positions: Position[]
  showForm: boolean
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>
  form: PosForm
  setForm: React.Dispatch<React.SetStateAction<PosForm>>
  onAdd: () => void
  onRemove: (id: string) => void
  markPrice: number | null
  suggestions?: Record<string, PosSuggestion>
}

export function PositionsPanel({
  positions,
  showForm,
  setShowForm,
  form,
  setForm,
  onAdd,
  onRemove,
  markPrice,
  suggestions,
}: PositionsPanelProps) {
  // Auto-calculate size when margin/leverage/entry changes
  useEffect(() => {
    const entry = parseFloat(form.entry)
    const margin = parseFloat(form.margin)
    const lev = parseFloat(form.leverage) || 10
    if (!entry || entry <= 0 || !margin || margin <= 0) return
    const notional = margin * lev
    const qty = notional / entry
    setForm((f) => ({
      ...f,
      size: qty.toFixed(6),
    }))
  }, [form.margin, form.leverage, form.entry, setForm])

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] text-sm">
        <div className="font-medium">Positions</div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? '×' : '+ Add'}
        </Button>
      </div>
      {showForm && (
        <div className="p-3 pt-2 border-b border-[var(--border)] space-y-2 text-xs">
          <div className="flex gap-2">
            <select
              className="flex-1 bg-[var(--surface-3)] border border-[var(--border)] rounded px-1.5 py-0.5"
              value={form.side}
              onChange={(e) => setForm((f) => ({ ...f, side: e.target.value }))}
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
            <select
              className="flex-1 bg-[var(--surface-3)] border border-[var(--border)] rounded px-1.5 py-0.5"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="isolated">Isolated</option>
              <option value="cross">Cross</option>
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-[9px] text-[var(--muted)] mb-0.5">Ký quỹ ($)</div>
              <Input
                type="number"
                min={1}
                placeholder="10"
                value={form.margin}
                onChange={(e) => setForm((f) => ({ ...f, margin: e.target.value }))}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex-1">
              <div className="text-[9px] text-[var(--muted)] mb-0.5">Leverage</div>
              <div className="flex">
                <span className="text-[var(--muted)] px-1">x</span>
                <Input
                  type="number"
                  min={1}
                  max={125}
                  value={form.leverage}
                  onChange={(e) => setForm((f) => ({ ...f, leverage: e.target.value }))}
                  className="h-7 text-xs flex-1"
                />
              </div>
            </div>
          </div>
          <Input
            className="font-mono text-xs h-7"
            type="number"
            placeholder="Giá mở (Entry)"
            value={form.entry}
            onChange={(e) => setForm((f) => ({ ...f, entry: e.target.value }))}
          />
          {form.entry &&
            parseFloat(form.entry) > 0 &&
            form.margin &&
            parseFloat(form.margin) > 0 && (
              <div className="text-[10px] text-[var(--muted)] flex gap-3">
                <span>
                  Size: ${(parseFloat(form.margin) * (parseFloat(form.leverage) || 10)).toFixed(2)}
                </span>
                <span>Qty: {form.size}</span>
              </div>
            )}
          <Input
            className="font-mono text-xs h-7"
            type="number"
            placeholder="Stop Loss (tuỳ chọn)"
            value={form.sl}
            onChange={(e) => setForm((f) => ({ ...f, sl: e.target.value }))}
          />
          <Button type="button" onClick={onAdd} size="sm" className="w-full text-xs h-7">
            Thêm vị thế
          </Button>
        </div>
      )}
      {positions.length === 0 && !showForm && (
        <div className="px-3 py-1 text-xs text-[var(--muted)]">Chưa có vị thế</div>
      )}
      {positions.map((p) => {
        const mark = markPrice ?? p.entryPrice
        const { pnl, pct } = calcPnl(p, mark)
        const liq = calcLiquidation(p)
        return (
          <div key={p.id} className="px-3 py-2 border-t border-[var(--border)] text-xs space-y-0.5">
            <div className="flex items-center justify-between">
              <span
                className={`${p.side === 'long' ? 'text-[var(--up)]' : 'text-[var(--dn)]'} font-medium`}
              >
                {p.side === 'long' ? '▲ LONG' : '▼ SHORT'}
              </span>
              <span className="text-[var(--muted)] text-[10px]">
                {p.type} · x{p.leverage ?? '?'}
              </span>
              <button
                type="button"
                className="text-[var(--dn)] hover:opacity-70"
                onClick={() => onRemove(p.id)}
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-0.5">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Entry</span>
                <span className="font-mono">{fmtP(p.entryPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Mark</span>
                <span className={`font-mono ${pnl >= 0 ? 'text-[var(--up)]' : 'text-[var(--dn)]'}`}>
                  {fmtP(mark)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Size</span>
                <span className="font-mono">{p.size.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Margin</span>
                <span className="font-mono">${p.margin.toFixed(2)}</span>
              </div>
              {p.stopLoss && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Stop Loss</span>
                  <span className="font-mono text-[var(--dn)]">{fmtP(p.stopLoss)}</span>
                </div>
              )}
              {liq && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Liq. ~</span>
                  <span className="font-mono" style={{ color: 'var(--amber)' }}>
                    {fmtP(liq)}
                  </span>
                </div>
              )}
              <div className="flex justify-between col-span-2">
                <span className="text-[var(--muted)]">PnL</span>
                <span className={`font-mono ${pnl >= 0 ? 'text-[var(--up)]' : 'text-[var(--dn)]'}`}>
                  {pnl >= 0 ? '+' : ''}
                  {pnl.toFixed(2)} $ ({pct >= 0 ? '+' : ''}
                  {pct.toFixed(2)}%)
                </span>
              </div>
              {suggestions?.[p.id] && (
                <div className="col-span-2 pt-1 text-[9px] opacity-80 border-t border-[var(--border)] mt-1">
                  Gợi ý: SL {fmtP(suggestions[p.id].sl)} · TP1 {fmtP(suggestions[p.id].tp1)} · TP2{' '}
                  {fmtP(suggestions[p.id].tp2)}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </Card>
  )
}
