// BTC Chart — Positions: manual tracking with add form and inline SL updates.

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { fmtP } from '../lib/format'
import { calcLiquidation, calcPnl, type PosForm, type Position } from '../lib/positions'
import type { TradeSetup } from '../lib/trade-setup'
import type { PositionPatch } from '../hooks/usePositions'

function formQtyLabel(form: PosForm): string {
  const entry = parseFloat(form.entry)
  const margin = parseFloat(form.margin)
  const lev = parseFloat(form.leverage) || 10
  if (!entry || entry <= 0 || !margin || margin <= 0) return ''
  return ((margin * lev) / entry).toFixed(6)
}

export interface PosSuggestion {
  sl: number
  tp1: number
  tp2: number
  tp3: number
}

export interface PositionsBodyProps {
  positions: Position[]
  showForm: boolean
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>
  form: PosForm
  setForm: React.Dispatch<React.SetStateAction<PosForm>>
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: PositionPatch) => void
  markPrice: number | null
  suggestions?: Record<string, PosSuggestion>
  setup?: TradeSetup
  onFillFromSetup?: () => void
}

function PositionCard({
  position: p,
  markPrice,
  suggestion,
  onRemove,
  onUpdate,
}: {
  position: Position
  markPrice: number | null
  suggestion?: PosSuggestion
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: PositionPatch) => void
}) {
  const [slDraft, setSlDraft] = useState(() => (p.stopLoss != null ? String(p.stopLoss) : ''))
  const [prevStopLoss, setPrevStopLoss] = useState(p.stopLoss)
  const mark = markPrice ?? p.entryPrice
  const { pnl, pct } = calcPnl(p, mark)
  const liq = calcLiquidation(p)

  if (p.stopLoss !== prevStopLoss) {
    setPrevStopLoss(p.stopLoss)
    setSlDraft(p.stopLoss != null ? String(p.stopLoss) : '')
  }

  const saveSl = () => {
    const trimmed = slDraft.trim()
    onUpdate(p.id, { stopLoss: trimmed ? parseFloat(trimmed) : null })
  }

  const applySuggestedSl = () => {
    if (!suggestion) return
    setSlDraft(String(suggestion.sl))
    onUpdate(p.id, { stopLoss: suggestion.sl })
  }

  return (
    <article className={cn('btc-chart__pos-card', p.side === 'long' ? 'is-long' : 'is-short')}>
      <div className="btc-chart__pos-card-head">
        <span className="btc-chart__pos-side">{p.side === 'long' ? 'LONG' : 'SHORT'}</span>
        <span className="btc-chart__pos-meta">
          {p.type} · x{p.leverage}
        </span>
        <button
          type="button"
          className="btc-chart__pos-remove"
          onClick={() => onRemove(p.id)}
          aria-label="Xóa vị thế"
        >
          ×
        </button>
      </div>

      <div className="btc-chart__pos-stats">
        <div className="btc-chart__pos-stat">
          <span className="btc-chart__pos-stat-key">Entry</span>
          <span className="btc-chart__pos-stat-val">{fmtP(p.entryPrice)}</span>
        </div>
        <div className="btc-chart__pos-stat">
          <span className="btc-chart__pos-stat-key">Mark</span>
          <span className={cn('btc-chart__pos-stat-val', pnl >= 0 ? 'up' : 'dn')}>
            {fmtP(mark)}
          </span>
        </div>
        <div className="btc-chart__pos-stat">
          <span className="btc-chart__pos-stat-key">Margin</span>
          <span className="btc-chart__pos-stat-val">${p.margin.toFixed(2)}</span>
        </div>
        <div className="btc-chart__pos-stat">
          <span className="btc-chart__pos-stat-key">PnL</span>
          <span className={cn('btc-chart__pos-stat-val', pnl >= 0 ? 'up' : 'dn')}>
            {pnl >= 0 ? '+' : ''}
            {pnl.toFixed(2)} ({pct >= 0 ? '+' : ''}
            {pct.toFixed(1)}%)
          </span>
        </div>
        {liq != null && (
          <div className="btc-chart__pos-stat btc-chart__pos-stat--wide">
            <span className="btc-chart__pos-stat-key">Liq ~</span>
            <span className="btc-chart__pos-stat-val warn">{fmtP(liq)}</span>
          </div>
        )}
      </div>

      <div className="btc-chart__pos-sl-row">
        <label className="btc-chart__pos-sl-label" htmlFor={`pos-sl-${p.id}`}>
          Stop loss
        </label>
        <input
          id={`pos-sl-${p.id}`}
          type="number"
          className="btc-chart__pos-input"
          placeholder="Chưa đặt"
          aria-label={`Stop loss cho vị thế ${p.side}`}
          value={slDraft}
          onChange={(e) => setSlDraft(e.target.value)}
        />
        <button type="button" className="btc-chart__pos-chip-btn" onClick={saveSl}>
          Lưu
        </button>
        {suggestion && (
          <button
            type="button"
            className="btc-chart__pos-chip-btn is-accent"
            onClick={applySuggestedSl}
            title={`Gợi ý SL ${fmtP(suggestion.sl)}`}
          >
            Gợi ý
          </button>
        )}
      </div>
    </article>
  )
}

/** Embeddable positions manager (Trade Setup drawer). */
export function PositionsBody({
  positions,
  showForm,
  setShowForm,
  form,
  setForm,
  onAdd,
  onRemove,
  onUpdate,
  markPrice,
  suggestions,
  setup,
  onFillFromSetup,
}: PositionsBodyProps) {
  const canFillSetup = Boolean(setup?.dir && onFillFromSetup)

  return (
    <div className="btc-chart__pos-body">
      <div className="btc-chart__pos-toolbar">
        <button
          type="button"
          className={cn('btc-chart__pos-primary-btn', showForm && 'is-on')}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Đóng form' : '+ Thêm vị thế'}
        </button>
        {canFillSetup && (
          <button
            type="button"
            className="btc-chart__pos-chip-btn is-accent"
            onClick={onFillFromSetup}
          >
            Lấy từ setup
          </button>
        )}
        {markPrice != null && markPrice > 0 && (
          <button
            type="button"
            className="btc-chart__pos-chip-btn"
            onClick={() => {
              setShowForm(true)
              setForm((f) => ({ ...f, entry: String(markPrice) }))
            }}
          >
            Giá hiện tại
          </button>
        )}
        <span className="btc-chart__pos-count">{positions.length} vị thế</span>
      </div>

      {showForm && (
        <form
          className="btc-chart__pos-form"
          onSubmit={(e) => {
            e.preventDefault()
            onAdd()
          }}
        >
          <div className="btc-chart__pos-form-row">
            <label className="btc-chart__pos-field">
              <span className="btc-chart__pos-field-label">Hướng</span>
              <select
                className="btc-chart__pos-select"
                value={form.side}
                onChange={(e) => setForm((f) => ({ ...f, side: e.target.value }))}
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </label>
            <label className="btc-chart__pos-field">
              <span className="btc-chart__pos-field-label">Margin</span>
              <select
                className="btc-chart__pos-select"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="isolated">Isolated</option>
                <option value="cross">Cross</option>
              </select>
            </label>
          </div>

          <div className="btc-chart__pos-form-row">
            <label className="btc-chart__pos-field">
              <span className="btc-chart__pos-field-label">Ký quỹ ($)</span>
              <input
                type="number"
                min={1}
                className="btc-chart__pos-input"
                placeholder="10"
                value={form.margin}
                onChange={(e) => setForm((f) => ({ ...f, margin: e.target.value }))}
              />
            </label>
            <label className="btc-chart__pos-field">
              <span className="btc-chart__pos-field-label">Leverage</span>
              <input
                type="number"
                min={1}
                max={125}
                className="btc-chart__pos-input"
                value={form.leverage}
                onChange={(e) => setForm((f) => ({ ...f, leverage: e.target.value }))}
              />
            </label>
          </div>

          <label className="btc-chart__pos-field btc-chart__pos-field--wide">
            <span className="btc-chart__pos-field-label">Entry</span>
            <input
              type="number"
              className="btc-chart__pos-input"
              placeholder="Giá mở"
              value={form.entry}
              onChange={(e) => setForm((f) => ({ ...f, entry: e.target.value }))}
            />
          </label>

          {form.entry &&
            parseFloat(form.entry) > 0 &&
            form.margin &&
            parseFloat(form.margin) > 0 && (
              <p className="btc-chart__pos-form-hint">
                Size ${(parseFloat(form.margin) * (parseFloat(form.leverage) || 10)).toFixed(2)} ·
                Qty {formQtyLabel(form)}
              </p>
            )}

          <label className="btc-chart__pos-field btc-chart__pos-field--wide">
            <span className="btc-chart__pos-field-label">Stop loss (tuỳ chọn)</span>
            <input
              type="number"
              className="btc-chart__pos-input"
              placeholder="SL"
              value={form.sl}
              onChange={(e) => setForm((f) => ({ ...f, sl: e.target.value }))}
            />
          </label>

          <button type="submit" className="btc-chart__pos-submit">
            Thêm vị thế
          </button>
        </form>
      )}

      {positions.length === 0 && !showForm && (
        <p className="btc-chart__pos-empty">
          Chưa có vị thế. Bấm &quot;Thêm vị thế&quot; hoặc &quot;Lấy từ setup&quot;.
        </p>
      )}

      {positions.length > 0 && (
        <div className="btc-chart__pos-list">
          {positions.map((p) => (
            <PositionCard
              key={p.id}
              position={p}
              markPrice={markPrice}
              suggestion={suggestions?.[p.id]}
              onRemove={onRemove}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export interface PositionsPanelProps extends PositionsBodyProps {}

/** @deprecated Prefer PositionsBody inside TradeSetupPanel. */
export function PositionsPanel(props: PositionsPanelProps) {
  return <PositionsBody {...props} />
}
