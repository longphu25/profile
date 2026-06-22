// BTC Chart — Positions panel: add-form + per-position PnL / liquidation rows.

import { type Position, type PosForm, calcLiquidation, calcPnl, fmtP } from '../lib'

export interface PositionsPanelProps {
  positions: Position[]
  showForm: boolean
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>
  form: PosForm
  setForm: React.Dispatch<React.SetStateAction<PosForm>>
  onAdd: () => void
  onRemove: (id: string) => void
  /** Latest mark price used for PnL; falls back to each entry price. */
  markPrice: number | null
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
}: PositionsPanelProps) {
  return (
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-header">
        <div className="btc-chart__panel-title">Positions</div>
        <button type="button" className="btc-chart__pos-add" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '×' : '+ Add'}
        </button>
      </div>
      {showForm && (
        <div className="btc-chart__pos-form">
          <div className="btc-chart__pos-row">
            <select
              className="btc-chart__pos-select"
              value={form.side}
              onChange={(e) => setForm((f) => ({ ...f, side: e.target.value }))}
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
            <select
              className="btc-chart__pos-select"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="isolated">Isolated</option>
              <option value="cross">Cross</option>
            </select>
          </div>
          <input
            className="btc-chart__pos-input"
            type="number"
            placeholder="Giá mở (Entry)"
            value={form.entry}
            onChange={(e) => setForm((f) => ({ ...f, entry: e.target.value }))}
          />
          <input
            className="btc-chart__pos-input"
            type="number"
            placeholder="Số lượng (Size)"
            value={form.size}
            onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
          />
          <input
            className="btc-chart__pos-input"
            type="number"
            placeholder="Ký quỹ USDT (Margin)"
            value={form.margin}
            onChange={(e) => setForm((f) => ({ ...f, margin: e.target.value }))}
          />
          <input
            className="btc-chart__pos-input"
            type="number"
            placeholder="Stop Loss (tuỳ chọn)"
            value={form.sl}
            onChange={(e) => setForm((f) => ({ ...f, sl: e.target.value }))}
          />
          <button type="button" className="btc-chart__pos-confirm" onClick={onAdd}>
            Thêm vị thế
          </button>
        </div>
      )}
      {positions.length === 0 && !showForm && (
        <span className="btc-chart__of-empty">Chưa có vị thế</span>
      )}
      {positions.map((p) => {
        const mark = markPrice ?? p.entryPrice
        const { pnl, pct } = calcPnl(p, mark)
        const liq = calcLiquidation(p)
        return (
          <div key={p.id} className="btc-chart__pos-item">
            <div className="btc-chart__pos-top">
              <span className={`btc-chart__pos-side ${p.side === 'long' ? 'up' : 'dn'}`}>
                {p.side === 'long' ? '▲ LONG' : '▼ SHORT'}
              </span>
              <span className="btc-chart__pos-badge">{p.type}</span>
              <button type="button" className="btc-chart__pos-del" onClick={() => onRemove(p.id)}>
                ×
              </button>
            </div>
            <div className="btc-chart__pos-rows">
              <div className="btc-chart__row">
                <span className="btc-chart__row-label">Entry</span>
                <span className="btc-chart__row-val">{fmtP(p.entryPrice)}</span>
              </div>
              <div className="btc-chart__row">
                <span className="btc-chart__row-label">Size</span>
                <span className="btc-chart__row-val">{p.size}</span>
              </div>
              <div className="btc-chart__row">
                <span className="btc-chart__row-label">Margin</span>
                <span className="btc-chart__row-val">{fmtP(p.margin)} USDT</span>
              </div>
              {p.stopLoss && (
                <div className="btc-chart__row">
                  <span className="btc-chart__row-label">Stop Loss</span>
                  <span className="btc-chart__row-val dn">{fmtP(p.stopLoss)}</span>
                </div>
              )}
              {liq && (
                <div className="btc-chart__row">
                  <span className="btc-chart__row-label">Liq. ~</span>
                  <span className="btc-chart__row-val" style={{ color: 'var(--amber)' }}>
                    {fmtP(liq)}
                  </span>
                </div>
              )}
              <div className="btc-chart__row">
                <span className="btc-chart__row-label">PnL</span>
                <span className={`btc-chart__row-val ${pnl >= 0 ? 'up' : 'dn'}`}>
                  {pnl >= 0 ? '+' : ''}
                  {pnl.toFixed(2)} USDT ({pct >= 0 ? '+' : ''}
                  {pct.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
