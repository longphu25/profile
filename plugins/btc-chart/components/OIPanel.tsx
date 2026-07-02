// BTC Chart — Open Interest + Market Cap panel.

import { fmtV } from '../lib'
import { Card } from '@/components/ui/card'

interface Props {
  oi: number | null
  mcap: number | null
  breakdown?: { exchange: string; usd: number }[]
}

export function OIPanel({ oi, mcap, breakdown }: Props) {
  const ratio = oi && mcap ? oi / mcap : null
  return (
    <Card className="p-3 text-xs">
      <div className="font-medium mb-1">Open Interest</div>
      <div className="flex justify-between">
        <span className="text-[var(--muted)]">OI (USD)</span>
        <span>{oi != null ? '$' + fmtV(oi) : '—'}</span>
      </div>
      {breakdown && breakdown.length > 0 && (
        <div className="text-[9px] text-[var(--muted)] mt-1">
          {breakdown.map((b) => (
            <span key={b.exchange} className="mr-2">
              {b.exchange}: ${fmtV(b.usd)}
            </span>
          ))}
        </div>
      )}
      <div className="flex justify-between mt-1">
        <span className="text-[var(--muted)]">Market Cap</span>
        <span>{mcap != null ? '$' + fmtV(mcap) : '—'}</span>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[var(--muted)]">OI / MCap</span>
        <span
          className={
            ratio != null && ratio > 1
              ? 'text-[var(--dn)]'
              : ratio != null && ratio > 0.5
                ? 'text-[var(--up)]'
                : ''
          }
        >
          {ratio != null ? ratio.toFixed(2) + 'x' : '—'}
        </span>
      </div>
      {ratio != null && (
        <div className="text-[9px] text-[var(--muted)] mt-1">
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
    </Card>
  )
}
