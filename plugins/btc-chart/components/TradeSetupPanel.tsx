// BTC Chart — Trade Setup panel showing auto-calculated Entry / SL / TP.
// Includes capital input + leverage slider for position sizing.

import { useState } from 'react'
import { fmtP, type TradeSetup } from '../lib'
import { ExplainModal } from './ExplainModal'

interface Props {
  setup: TradeSetup
}

export function TradeSetupPanel({ setup }: Props) {
  const [capital, setCapital] = useState(10)
  const [leverage, setLeverage] = useState(10)
  const [open, setOpen] = useState(false)
  const [explainOpen, setExplainOpen] = useState(false)

  if (!setup.dir) {
    return (
      <div className="btc-chart__panel btc-chart__setup-panel">
        <div className="btc-chart__setup-hdr btc-chart__setup-hdr--static">
          <span className="btc-chart__setup-title">Trade Setup</span>
          <span className="btc-chart__setup-summary muted">Chờ confluence (2+ signals)</span>
          <button
            type="button"
            className="btc-chart__explain-btn"
            onClick={() => setExplainOpen(true)}
            title="Giải thích chỉ báo & tín hiệu"
          >
            ?
          </button>
        </div>
        {explainOpen && <ExplainModal setup={setup} onClose={() => setExplainOpen(false)} />}
      </div>
    )
  }
  const isLong = setup.dir === 'long'
  const risk = Math.abs(setup.entry - setup.sl)
  const riskPct = ((risk / setup.entry) * 100).toFixed(2)
  const rrStr = setup.rr > 0 ? setup.rr.toFixed(1) : '2.0'

  // Position sizing
  const positionSize = capital * leverage
  const qty = positionSize / setup.entry
  const lossAtSL = qty * risk
  const profitAtTP1 = qty * Math.abs(setup.tp1 - setup.entry)
  const profitAtTP2 = qty * Math.abs(setup.tp2 - setup.entry)
  const liqDistance = isLong ? setup.entry * (1 - 1 / leverage) : setup.entry * (1 + 1 / leverage)

  // Categorize reasons
  const mlReasons = setup.reasons.filter(
    (r) =>
      (r.startsWith('ML') || r.startsWith('RSI') || r.startsWith('ADX') || r.includes('NWE')) &&
      !r.startsWith('NWE Cross') &&
      !r.startsWith('Price at Lux') &&
      !r.includes('Lux NWE mid'),
  )
  const boucherReasons = setup.reasons.filter(
    (r) => r.startsWith('Boucher') || r.startsWith('3-Bar') || r.startsWith('Box'),
  )
  const lienReasons = setup.reasons.filter(
    (r) => r.startsWith('Lien') || r.startsWith('Squeeze') || r.startsWith('Exhaustion'),
  )
  const nweReasons = setup.reasons.filter(
    (r) => r.startsWith('NWE Cross') || r.startsWith('Price at Lux') || r.includes('Lux NWE mid'),
  )

  return (
    <div className={`btc-chart__panel btc-chart__setup-panel${open ? ' is-open' : ''}`}>
      <div className="btc-chart__setup-hdr-row">
        <button type="button" className="btc-chart__setup-hdr" onClick={() => setOpen((o) => !o)}>
          <span className="btc-chart__collapse-caret">{open ? '▾' : '▸'}</span>
          <span className="btc-chart__setup-title">Trade Setup</span>
          <span className="btc-chart__setup-summary">
            <span className={isLong ? 'up' : 'dn'}>{isLong ? '▲ LONG' : '▼ SHORT'}</span>
            <span className="btc-chart__setup-conf">{setup.confidence}%</span>
            <span className="muted">{setup.reasons.length} sig</span>
          </span>
        </button>
        <button
          type="button"
          className="btc-chart__explain-btn"
          onClick={() => setExplainOpen(true)}
          title="Giải thích chỉ báo & tín hiệu"
        >
          ?
        </button>
      </div>

      {explainOpen && <ExplainModal setup={setup} onClose={() => setExplainOpen(false)} />}

      {open && (
        <div className="btc-chart__setup-body">
          {/* Capital + Leverage inputs */}
          <div className="btc-chart__setup-sizing">
            <div className="btc-chart__setup-capital">
              <label className="lbl">Von ($)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={capital}
                onChange={(e) => setCapital(Math.max(1, +e.target.value || 1))}
                className="btc-chart__setup-input"
              />
            </div>
            <div className="btc-chart__setup-lev">
              <label className="lbl">Leverage</label>
              <div className="btc-chart__setup-lev-row">
                <span className="btc-chart__setup-lev-x">x</span>
                <input
                  type="number"
                  min={1}
                  max={125}
                  value={leverage}
                  onChange={(e) => setLeverage(Math.max(1, Math.min(125, +e.target.value || 1)))}
                  className="btc-chart__setup-input"
                />
              </div>
            </div>
          </div>

          {/* Price levels */}
          <table className="btc-chart__setup-tbl">
            <tbody>
              <tr>
                <td className="lbl">Entry</td>
                <td>{fmtP(setup.entry)}</td>
              </tr>
              <tr className="dn-row">
                <td className="lbl">Stop Loss</td>
                <td>
                  {fmtP(setup.sl)} <span className="muted">(-{riskPct}%)</span>
                </td>
              </tr>
              <tr className="up-row">
                <td className="lbl">TP1 (1:{rrStr})</td>
                <td>{fmtP(setup.tp1)}</td>
              </tr>
              <tr className="up-row">
                <td className="lbl">TP2</td>
                <td>{fmtP(setup.tp2)}</td>
              </tr>
            </tbody>
          </table>

          {/* Calculated position details */}
          <div className="btc-chart__setup-calc">
            <div className="btc-chart__setup-calc-row">
              <span className="lbl">Vol</span>
              <span className={setup.volRatio >= 1.5 ? 'up' : setup.volRatio < 0.5 ? 'dn' : ''}>
                {setup.volRatio.toFixed(1)}x avg
                {setup.volRatio >= 1.5 ? ' (confirmed)' : setup.volRatio < 0.5 ? ' (weak)' : ''}
              </span>
            </div>
            <div className="btc-chart__setup-calc-row">
              <span className="lbl">Size</span>
              <span>${positionSize.toFixed(2)}</span>
            </div>
            <div className="btc-chart__setup-calc-row">
              <span className="lbl">Qty</span>
              <span>{qty.toFixed(6)}</span>
            </div>
            <div className="btc-chart__setup-calc-row dn-row">
              <span className="lbl">Loss (SL)</span>
              <span>-${lossAtSL.toFixed(2)}</span>
            </div>
            <div className="btc-chart__setup-calc-row up-row">
              <span className="lbl">Profit (TP1)</span>
              <span>+${profitAtTP1.toFixed(2)}</span>
            </div>
            <div className="btc-chart__setup-calc-row up-row">
              <span className="lbl">Profit (TP2)</span>
              <span>+${profitAtTP2.toFixed(2)}</span>
            </div>
            <div className="btc-chart__setup-calc-row">
              <span className="lbl">Liq. Price</span>
              <span className="dn">{fmtP(liqDistance)}</span>
            </div>
          </div>

          {/* Signal sources grouped */}
          <div className="btc-chart__setup-sources">
            {mlReasons.length > 0 && (
              <div className="btc-chart__setup-src">
                <span className="btc-chart__setup-src-label">Indicators</span>
                {mlReasons.map((r) => (
                  <span key={r} className="btc-chart__setup-tag">
                    {r}
                  </span>
                ))}
              </div>
            )}
            {boucherReasons.length > 0 && (
              <div className="btc-chart__setup-src">
                <span className="btc-chart__setup-src-label">Boucher</span>
                {boucherReasons.map((r) => (
                  <span key={r} className="btc-chart__setup-tag btc-chart__setup-tag--boucher">
                    {r}
                  </span>
                ))}
              </div>
            )}
            {lienReasons.length > 0 && (
              <div className="btc-chart__setup-src">
                <span className="btc-chart__setup-src-label">Lien</span>
                {lienReasons.map((r) => (
                  <span key={r} className="btc-chart__setup-tag btc-chart__setup-tag--lien">
                    {r}
                  </span>
                ))}
              </div>
            )}
            {nweReasons.length > 0 && (
              <div className="btc-chart__setup-src">
                <span className="btc-chart__setup-src-label">Lux NWE</span>
                {nweReasons.map((r) => (
                  <span key={r} className="btc-chart__setup-tag btc-chart__setup-tag--nwe">
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="btc-chart__setup-count">{setup.reasons.length} signals</div>
        </div>
      )}
    </div>
  )
}
