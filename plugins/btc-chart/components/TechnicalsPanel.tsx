// BTC Chart — Technicals readout: one signal row per indicator.

import type { SidebarState } from '../lib'

const ROWS: { label: string; key: keyof SidebarState }[] = [
  { label: 'MH Signal', key: 'sigNwe' },
  { label: 'RSI · 14', key: 'sigRsi' },
  { label: 'MA 50 / 200', key: 'sigMa' },
  { label: 'MACD', key: 'sigMacd' },
  { label: 'Trend', key: 'sigTrend' },
  { label: 'ADX / DMI', key: 'sigAdx' },
  { label: 'Stoch RSI', key: 'sigStoch' },
  { label: 'OBV', key: 'sigObv' },
  { label: 'VWAP', key: 'sigVwap' },
  { label: 'RSI Divergence', key: 'sigDiv' },
]

export function TechnicalsPanel({ sidebar }: { sidebar: SidebarState }) {
  return (
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-title">Technicals</div>
      {ROWS.map(({ label, key }) => {
        const sig = sidebar[key] as { text: string; cls: string }
        return (
          <div key={label} className="btc-chart__row">
            <span className="btc-chart__row-label">{label}</span>
            <span className={`btc-chart__row-val ${sig.cls}`}>{sig.text}</span>
          </div>
        )
      })}
    </div>
  )
}
