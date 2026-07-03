// BTC Chart — Technicals readout: one signal row per indicator.

import type { SidebarState } from '../lib/types'
import { Card } from '@/components/ui/card'

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
    <Card className="p-2">
      <div className="uppercase text-[8.5px] tracking-[1px] text-[var(--muted)] mb-1">
        TECHNICALS
      </div>
      <div className="space-y-px text-[10px]">
        {ROWS.map(({ label, key }) => {
          const sig = sidebar[key] as { text: string; cls: string }
          return (
            <div key={label} className="flex justify-between font-mono tabular-nums">
              <span className="text-[var(--muted)]">{label}</span>
              <span className={sig.cls}>{sig.text}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
