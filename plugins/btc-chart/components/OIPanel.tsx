// BTC Chart — Open Interest + Market Cap panel.

import {
  buildOiSparklinePoints,
  fmtV,
  formatOiDeltaPct,
  oiDeltaClass,
  type OiDeltaPct,
  type OiHistoryPoint,
} from '../lib'
import { Card } from '@/components/ui/card'

interface Props {
  oi: number | null
  mcap: number | null
  breakdown?: { exchange: string; usd: number }[]
  history?: OiHistoryPoint[]
  deltaPct?: OiDeltaPct
}

const SPARK_W = 200
const SPARK_H = 36

function OiDeltaChip({ label, value }: { label: string; value: number | null }) {
  const cls = oiDeltaClass(value)
  return (
    <div className="oi-delta-chip">
      <span className="oi-delta-chip__label">{label}</span>
      <span className={cls ? `oi-delta-chip__value ${cls}` : 'oi-delta-chip__value'}>
        {formatOiDeltaPct(value)}
      </span>
    </div>
  )
}

function OiSparkline({ history }: { history: OiHistoryPoint[] }) {
  const values = history.map((p) => p.totalUsd)
  const points = buildOiSparklinePoints(values, SPARK_W, SPARK_H)
  if (!points) return null

  const first = values[0] ?? 0
  const last = values[values.length - 1] ?? 0
  const up = last >= first
  const stroke = up ? 'var(--up)' : 'var(--dn)'

  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="oi-sparkline"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function OIPanel({ oi, mcap, breakdown, history, deltaPct }: Props) {
  const ratio = oi && mcap ? oi / mcap : null
  const hist = history ?? []
  const delta = deltaPct ?? { h1: null, h4: null, h24: null }
  const hasTrend = hist.length >= 2

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

      {hasTrend && (
        <>
          <div className="oi-delta-row mt-2">
            <OiDeltaChip label="1h" value={delta.h1} />
            <OiDeltaChip label="4h" value={delta.h4} />
            <OiDeltaChip label="24h" value={delta.h24} />
          </div>
          <OiSparkline history={hist} />
          <div className="text-[9px] text-[var(--muted)] mt-1">
            Trend: Binance USD (1h) · Now: Binance+Bybit
          </div>
        </>
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
