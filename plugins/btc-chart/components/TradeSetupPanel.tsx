// BTC Chart — Trade Setup panel showing auto-calculated Entry / SL / TP.

import { fmtP, type TradeSetup } from '../lib'

interface Props {
  setup: TradeSetup
}

export function TradeSetupPanel({ setup }: Props) {
  if (!setup.dir) {
    return (
      <div className="btc-chart__panel">
        <h4>Trade Setup</h4>
        <p className="muted">Chưa có tín hiệu confluence (cần ≥2 indicators đồng thuận)</p>
      </div>
    )
  }
  const isLong = setup.dir === 'long'
  const risk = Math.abs(setup.entry - setup.sl)
  const riskPct = ((risk / setup.entry) * 100).toFixed(2)
  return (
    <div className="btc-chart__panel">
      <h4>
        Trade Setup <span className={isLong ? 'up' : 'dn'}>{isLong ? '▲ LONG' : '▼ SHORT'}</span>
        <span className="muted" style={{ marginLeft: 6, fontSize: 10 }}>
          {setup.confidence}% conf
        </span>
      </h4>
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
            <td className="lbl">TP1 (1:2)</td>
            <td>{fmtP(setup.tp1)}</td>
          </tr>
          <tr className="up-row">
            <td className="lbl">TP2 (1:3)</td>
            <td>{fmtP(setup.tp2)}</td>
          </tr>
        </tbody>
      </table>
      <div className="btc-chart__setup-reasons">
        {setup.reasons.map((r) => (
          <span key={r} className="btc-chart__setup-tag">
            {r}
          </span>
        ))}
      </div>
    </div>
  )
}
