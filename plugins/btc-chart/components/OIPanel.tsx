// BTC Chart — Open Interest + Market Cap panel.

import { fmtV } from '../lib'

interface Props {
  oi: number | null
  mcap: number | null
  breakdown?: { exchange: string; usd: number }[]
}

export function OIPanel({ oi, mcap, breakdown }: Props) {
  const ratio = oi && mcap ? oi / mcap : null
  return (
    <div className="btc-chart__panel">
      <h4>Open Interest</h4>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">OI (USD)</span>
        <span className="btc-chart__row-val">{oi != null ? '$' + fmtV(oi) : '—'}</span>
      </div>
      {breakdown && breakdown.length > 0 && (
        <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 3 }}>
          {breakdown.map((b) => (
            <span key={b.exchange} style={{ marginRight: 8 }}>
              {b.exchange}: ${fmtV(b.usd)}
            </span>
          ))}
        </div>
      )}
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">Market Cap</span>
        <span className="btc-chart__row-val">{mcap != null ? '$' + fmtV(mcap) : '—'}</span>
      </div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">OI / MCap</span>
        <span
          className={`btc-chart__row-val${ratio != null && ratio > 1 ? ' dn' : ratio != null && ratio > 0.5 ? ' up' : ''}`}
        >
          {ratio != null ? ratio.toFixed(2) + 'x' : '—'}
        </span>
      </div>
      {ratio != null && (
        <div style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>
          {ratio > 1.5
            ? '⚠️ Cực kỳ rủi ro, dễ bị squeeze mạnh'
            : ratio > 1
              ? '⚠️ Leverage cao, cẩn thận long/short squeeze'
              : ratio > 0.5
                ? '⚡ Leverage vừa phải, biến động có thể tăng'
                : ratio > 0.2
                  ? '✅ Bình thường, thị trường ổn định'
                  : '🧊 OI thấp, ít quan tâm từ derivatives'}
        </div>
      )}
    </div>
  )
}
