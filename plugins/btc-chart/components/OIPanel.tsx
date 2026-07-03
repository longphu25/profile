// BTC Chart — Open Interest + Market Cap panel.

import { fmtV } from '../lib/format'
import {
  buildOiSparklinePoints,
  formatOiDeltaPct,
  oiDeltaClass,
  type OiDeltaPct,
  type OiHistoryPoint,
} from '../lib/open-interest'
import { StatGrid, StatCell, SideNote } from './sidebar/SidebarBlocks'

interface Props {
  oi: number | null
  mcap: number | null
  breakdown?: { exchange: string; usd: number }[]
  history?: OiHistoryPoint[]
  deltaPct?: OiDeltaPct
}

const SPARK_W = 240
const SPARK_H = 48

function OiDeltaChip({ label, value }: { label: string; value: number | null }) {
  const tone = oiDeltaClass(value)
  return (
    <div className={`btc-chart__oi-delta${tone ? ` is-${tone}` : ''}`}>
      <span className="btc-chart__oi-delta-label">{label}</span>
      <span className="btc-chart__oi-delta-value">{formatOiDeltaPct(value)}</span>
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
      className="btc-chart__oi-sparkline"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function ratioNote(ratio: number): string {
  if (ratio > 1.5) return 'Cực kỳ rủi ro, dễ bị squeeze mạnh'
  if (ratio > 1) return 'Leverage cao, cẩn thận long/short squeeze'
  if (ratio > 0.5) return 'Leverage vừa phải, biến động có thể tăng'
  if (ratio > 0.2) return 'Bình thường, thị trường ổn định'
  return 'OI thấp, ít quan tâm từ derivatives'
}

function ratioTone(ratio: number | null): 'up' | 'dn' | 'hi' | '' {
  if (ratio == null) return ''
  if (ratio > 1) return 'dn'
  if (ratio > 0.5) return 'hi'
  return 'up'
}

export function OIPanel({ oi, mcap, breakdown, history, deltaPct }: Props) {
  const ratio = oi && mcap ? oi / mcap : null
  const hist = history ?? []
  const delta = deltaPct ?? { h1: null, h4: null, h24: null }
  const hasTrend = hist.length >= 2
  const oiDisplay = oi != null ? `$${fmtV(oi)}` : '—'

  return (
    <div className="btc-chart__oi-panel">
      <div className="btc-chart__oi-hero">
        <span className="btc-chart__oi-hero-kicker">Tổng Open Interest</span>
        <span className="btc-chart__oi-hero-value">{oiDisplay}</span>
        <span className="btc-chart__oi-hero-unit">USD · Binance + Bybit</span>
      </div>

      {breakdown && breakdown.length > 0 && (
        <StatGrid cols={2}>
          {breakdown.map((b) => (
            <StatCell key={b.exchange} label={b.exchange} value={`$${fmtV(b.usd)}`} />
          ))}
        </StatGrid>
      )}

      {hasTrend && (
        <div className="btc-chart__oi-trend">
          <div className="btc-chart__oi-delta-row">
            <OiDeltaChip label="1H" value={delta.h1} />
            <OiDeltaChip label="4H" value={delta.h4} />
            <OiDeltaChip label="24H" value={delta.h24} />
          </div>
          <div className="btc-chart__oi-chart">
            <OiSparkline history={hist} />
          </div>
          <p className="btc-chart__oi-chart-caption">Xu hướng OI Binance (1h) · hiện tại gộp sàn</p>
        </div>
      )}

      <StatGrid cols={2}>
        <StatCell label="Market Cap" value={mcap != null ? `$${fmtV(mcap)}` : '—'} />
        <StatCell
          label="OI / MCap"
          value={ratio != null ? `${ratio.toFixed(2)}x` : '—'}
          tone={ratioTone(ratio)}
        />
      </StatGrid>

      {ratio != null && <SideNote>{ratioNote(ratio)}</SideNote>}
    </div>
  )
}
